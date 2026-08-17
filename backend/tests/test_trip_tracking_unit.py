import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from backend.app.models.device import Device
from backend.app.models.trip import Trip
from backend.app.models.location import Location
from backend.app.schemas.location import LocationCreate
from backend.app.schemas.trip import TripResponse, TripSummaryResponse
from backend.app.services.trip_service import (
    TripService,
    format_duration,
    DEFAULT_TRIP_START_SPEED_KMH,
    DEFAULT_TRIP_IDLE_TIMEOUT_SECONDS,
)
from backend.app.services.location_service import LocationService, haversine_distance_meters


def test_format_duration():
    assert format_duration(None) is None
    assert format_duration(timedelta(seconds=0)) == "00:00:00"
    assert format_duration(timedelta(seconds=45)) == "00:00:45"
    assert format_duration(timedelta(minutes=5, seconds=30)) == "00:05:30"
    assert format_duration(timedelta(hours=2, minutes=15, seconds=10)) == "02:15:10"


def test_trip_start_when_moving_above_threshold():
    """Test that a device with speed >= 5 km/h starts an active trip when no active trip exists."""
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-TRIP", user_id="00000000-0000-0000-0000-000000000001")

    # DB mocks: no prev location, no active trip, no geofences
    query_mock = MagicMock()
    query_mock.filter.return_value.order_by.return_value.first.return_value = None
    query_mock.filter.return_value.all.return_value = []
    mock_db.query.return_value = query_mock

    now = datetime(2026, 8, 16, 10, 0, 0, tzinfo=timezone.utc)
    loc_in = LocationCreate(
        latitude=18.520430,
        longitude=73.856744,
        speed=15.0,  # >= 5.0
        timestamp=now
    )

    location, alerts, trip_event = LocationService.ingest_location(mock_db, mock_device, loc_in)

    assert location is not None
    assert trip_event is not None
    assert trip_event["event"] == "trip_started"
    trip = trip_event["trip"]
    assert trip.device_id == 1
    assert trip.start_time == now
    assert trip.end_time is None
    assert float(trip.distance) == 0.0
    assert float(trip.max_speed) == 15.0


def test_no_trip_started_when_stationary():
    """Test that speed < 5 km/h does NOT start a new trip if none is active."""
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-TRIP", user_id="00000000-0000-0000-0000-000000000001")

    query_mock = MagicMock()
    query_mock.filter.return_value.order_by.return_value.first.return_value = None
    query_mock.filter.return_value.all.return_value = []
    mock_db.query.return_value = query_mock

    now = datetime(2026, 8, 16, 10, 0, 0, tzinfo=timezone.utc)
    loc_in = LocationCreate(
        latitude=18.520430,
        longitude=73.856744,
        speed=2.0,  # < 5.0
        timestamp=now
    )

    location, alerts, trip_event = LocationService.ingest_location(mock_db, mock_device, loc_in)
    assert location is not None
    assert trip_event is None


def test_active_trip_distance_and_speed_accumulation():
    """Test that ongoing trip accumulates Haversine distance and updates max/avg speed."""
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-TRIP", user_id="00000000-0000-0000-0000-000000000001")

    t0 = datetime(2026, 8, 16, 10, 0, 0, tzinfo=timezone.utc)
    active_trip = Trip(
        id=50,
        device_id=1,
        start_time=t0,
        end_time=None,
        distance=Decimal("1.000"),
        duration=timedelta(minutes=5),
        max_speed=Decimal("20.00"),
        average_speed=Decimal("12.00")
    )

    prev_loc = Location(
        id=100,
        device_id=1,
        latitude=18.520000,
        longitude=73.850000,
        speed=20.0,
        timestamp=t0 + timedelta(minutes=5)
    )

    # Ingest next location ~1 km away, 2 minutes later
    t1 = t0 + timedelta(minutes=7)
    curr_in = LocationCreate(
        latitude=18.528000,
        longitude=73.855000,
        speed=35.0,
        timestamp=t1
    )

    def mock_query(*models):
        m = MagicMock()
        model = models[0] if models else None
        if model is Location or getattr(model, "class_", None) is Location:
            m.filter.return_value.order_by.return_value.first.return_value = prev_loc
        elif model is Trip or getattr(model, "class_", None) is Trip:
            m.filter.return_value.order_by.return_value.first.return_value = active_trip
        else:
            m.filter.return_value.all.return_value = []
        return m

    mock_db.query.side_effect = mock_query

    location, alerts, trip_event = LocationService.ingest_location(mock_db, mock_device, curr_in)

    assert trip_event is not None
    assert trip_event["event"] == "trip_updated"
    assert float(active_trip.distance) > 1.0  # Accumulated
    assert float(active_trip.max_speed) == 35.0  # Updated max speed
    assert active_trip.duration == timedelta(minutes=7)
    assert float(active_trip.average_speed) > 0.0


def test_trip_idle_timeout_completion():
    """Test that inactivity > 300s completes the active trip."""
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-TRIP", user_id="00000000-0000-0000-0000-000000000001")

    t0 = datetime(2026, 8, 16, 10, 0, 0, tzinfo=timezone.utc)
    active_trip = Trip(
        id=50,
        device_id=1,
        start_time=t0,
        end_time=None,
        distance=Decimal("5.200"),
        duration=timedelta(minutes=20),
        max_speed=Decimal("30.00"),
        average_speed=Decimal("15.60")
    )

    prev_loc = Location(
        id=100,
        device_id=1,
        latitude=18.520000,
        longitude=73.850000,
        speed=0.0,
        timestamp=t0 + timedelta(minutes=20)
    )

    # Next location received 10 minutes later (600s > 300s idle timeout) with speed 0
    t1 = t0 + timedelta(minutes=30)
    curr_in = LocationCreate(
        latitude=18.520000,
        longitude=73.850000,
        speed=0.0,
        timestamp=t1
    )

    def mock_query(*models):
        m = MagicMock()
        model = models[0] if models else None
        if model is Location or getattr(model, "class_", None) is Location:
            m.filter.return_value.order_by.return_value.first.return_value = prev_loc
        elif model is Trip or getattr(model, "class_", None) is Trip:
            m.filter.return_value.order_by.return_value.first.return_value = active_trip
        else:
            m.filter.return_value.all.return_value = []
        return m

    mock_db.query.side_effect = mock_query

    location, alerts, trip_event = LocationService.ingest_location(mock_db, mock_device, curr_in)

    assert trip_event is not None
    assert trip_event["event"] == "trip_completed"
    assert active_trip.end_time == prev_loc.timestamp
    assert active_trip.duration == timedelta(minutes=20)


def test_gps_jump_filtering():
    """Test that an unrealistic GPS jump (> 150 km/h) is filtered from distance accumulation."""
    active_trip = Trip(
        id=1,
        device_id=1,
        start_time=datetime(2026, 8, 16, 10, 0, 0, tzinfo=timezone.utc),
        end_time=None,
        distance=Decimal("2.000"),
        duration=timedelta(minutes=5),
        max_speed=Decimal("25.00"),
        average_speed=Decimal("24.00")
    )

    mock_db = MagicMock()
    # Delta distance of 50 km in 5 seconds = 36000 km/h (filtered)
    TripService.update_active_trip(
        mock_db,
        active_trip,
        delta_distance_km=0.0,  # Filtered jump ignored
        current_speed=20.0,
        current_time=datetime(2026, 8, 16, 10, 5, 5, tzinfo=timezone.utc)
    )

    assert float(active_trip.distance) == 2.000


def test_trip_summary_calculation():
    """Test aggregated trip statistics."""
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="DEV-SUM-1")

    t1 = datetime(2026, 8, 15, 8, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 8, 16, 9, 0, 0, tzinfo=timezone.utc)

    trip1 = Trip(
        id=1,
        device_id=1,
        start_time=t1,
        end_time=t1 + timedelta(minutes=30),
        distance=Decimal("10.5"),
        max_speed=Decimal("45.0"),
        average_speed=Decimal("21.0"),
        duration=timedelta(minutes=30)
    )

    trip2 = Trip(
        id=2,
        device_id=1,
        start_time=t2,
        end_time=t2 + timedelta(minutes=45),
        distance=Decimal("15.5"),
        max_speed=Decimal("52.0"),
        average_speed=Decimal("20.67"),
        duration=timedelta(minutes=45)
    )

    mock_db.query.return_value.filter.return_value.all.return_value = [trip1, trip2]

    summary = TripService.get_device_trip_summary(mock_db, mock_device)

    assert summary["total_trips"] == 2
    assert summary["total_distance_km"] == 26.0
    assert summary["average_trip_distance_km"] == 13.0
    assert summary["longest_trip_distance_km"] == 15.5
    assert summary["max_recorded_speed_kmh"] == 52.0
    assert summary["last_trip_start_time"] == t2


def test_trip_schemas():
    now = datetime.now(timezone.utc)
    res = TripResponse(
        id=10,
        device_id="BIKE-001",
        start_time=now,
        end_time=None,
        distance=5.5,
        duration="00:15:30",
        max_speed=30.0,
        average_speed=21.3,
        created_at=now,
        status="ACTIVE"
    )
    assert res.id == 10
    assert res.status == "ACTIVE"

    sum_res = TripSummaryResponse(
        device_id="BIKE-001",
        total_trips=5,
        total_distance_km=42.5,
        average_trip_distance_km=8.5,
        longest_trip_distance_km=15.0,
        max_recorded_speed_kmh=48.2,
        last_trip_start_time=now
    )
    assert sum_res.total_trips == 5
    assert sum_res.total_distance_km == 42.5
