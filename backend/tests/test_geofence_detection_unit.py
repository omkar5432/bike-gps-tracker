import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone
from backend.app.services.location_service import (
    haversine_distance_meters,
    LocationService,
    DEFAULT_OVERSPEED_THRESHOLD_KMH,
)
from backend.app.schemas.location import LocationCreate
from backend.app.models.device import Device, DeviceStatus
from backend.app.models.location import Location
from backend.app.models.geofence import Geofence
from backend.app.models.alert import Alert

def test_haversine_distance_calculation():
    # Distance between Pune Railway Station and Shaniwar Wada (~2.8 km)
    pune_station_lat, pune_station_lon = 18.5284, 73.8744
    shaniwar_wada_lat, shaniwar_wada_lon = 18.5196, 73.8553
    
    dist = haversine_distance_meters(
        pune_station_lat, pune_station_lon,
        shaniwar_wada_lat, shaniwar_wada_lon
    )
    # Expected approx 2200m - 2500m
    assert 2000.0 < dist < 3000.0

    # Same point distance should be 0
    assert haversine_distance_meters(18.520430, 73.856744, 18.520430, 73.856744) == 0.0

from backend.app.models.trip import Trip

def _setup_mock_db(prev_loc, geofences=None):
    mock_db = MagicMock()
    if geofences is None:
        geofences = []

    def mock_query(*models):
        m = MagicMock()
        model = models[0] if models else None
        if model is Location or getattr(model, "class_", None) is Location:
            m.filter.return_value.order_by.return_value.first.return_value = prev_loc
        elif model == Geofence:
            m.filter.return_value.all.return_value = geofences
        elif model == Trip:
            m.filter.return_value.order_by.return_value.first.return_value = None
            m.filter.return_value.all.return_value = []
        else:
            m.filter.return_value.all.return_value = []
            m.filter.return_value.first.return_value = None
        return m

    mock_db.query.side_effect = mock_query
    return mock_db

def test_geofence_enter_state_transition():
    """Test Outside -> Inside transition generates GEOFENCE_ENTER alert."""
    mock_device = Device(id=1, device_id="TEST-DEV-1", user_id="00000000-0000-0000-0000-000000000001")

    geo = Geofence(
        id=10,
        device_id=1,
        name="Home Safe Zone",
        latitude=18.520430,
        longitude=73.856744,
        radius=500.0,
        enabled=True
    )

    prev_loc = Location(
        id=100,
        device_id=1,
        latitude=18.540000,
        longitude=73.856744,
        speed=20.0,
        timestamp=datetime.now(timezone.utc)
    )

    curr_in = LocationCreate(
        latitude=18.520430,
        longitude=73.856744,
        speed=15.0,
        timestamp=datetime.now(timezone.utc)
    )

    mock_db = _setup_mock_db(prev_loc, [geo])
    location, alerts, *_ = LocationService.ingest_location(mock_db, mock_device, curr_in)

    assert location is not None
    assert len(alerts) == 1
    assert alerts[0].type == "GEOFENCE_ENTER"
    assert "Home Safe Zone" in alerts[0].message
    assert alerts[0].acknowledged is False

def test_geofence_inside_to_inside_no_duplicate():
    """Test Inside -> Inside does NOT generate duplicate GEOFENCE_ENTER alert."""
    mock_device = Device(id=1, device_id="TEST-DEV-1", user_id="00000000-0000-0000-0000-000000000001")

    geo = Geofence(
        id=10,
        device_id=1,
        name="Home Safe Zone",
        latitude=18.520430,
        longitude=73.856744,
        radius=500.0,
        enabled=True
    )

    prev_loc = Location(
        id=100,
        device_id=1,
        latitude=18.521000,
        longitude=73.856744,
        speed=10.0,
        timestamp=datetime.now(timezone.utc)
    )

    curr_in = LocationCreate(
        latitude=18.521500,
        longitude=73.856744,
        speed=12.0,
        timestamp=datetime.now(timezone.utc)
    )

    mock_db = _setup_mock_db(prev_loc, [geo])
    location, alerts, *_ = LocationService.ingest_location(mock_db, mock_device, curr_in)

    assert location is not None
    geofence_alerts = [a for a in alerts if "GEOFENCE" in a.type]
    assert len(geofence_alerts) == 0

def test_geofence_exit_state_transition():
    """Test Inside -> Outside transition generates GEOFENCE_EXIT alert."""
    mock_device = Device(id=1, device_id="TEST-DEV-1", user_id="00000000-0000-0000-0000-000000000001")

    geo = Geofence(
        id=10,
        device_id=1,
        name="Home Safe Zone",
        latitude=18.520430,
        longitude=73.856744,
        radius=500.0,
        enabled=True
    )

    prev_loc = Location(
        id=100,
        device_id=1,
        latitude=18.520500,
        longitude=73.856744,
        speed=25.0,
        timestamp=datetime.now(timezone.utc)
    )

    curr_in = LocationCreate(
        latitude=18.535000,
        longitude=73.856744,
        speed=30.0,
        timestamp=datetime.now(timezone.utc)
    )

    mock_db = _setup_mock_db(prev_loc, [geo])
    location, alerts, *_ = LocationService.ingest_location(mock_db, mock_device, curr_in)

    assert location is not None
    assert len(alerts) == 1
    assert alerts[0].type == "GEOFENCE_EXIT"
    assert "Home Safe Zone" in alerts[0].message

def test_disabled_geofence_generates_no_alerts():
    """Test disabled geofences are excluded and generate no alerts."""
    mock_device = Device(id=1, device_id="TEST-DEV-1", user_id="00000000-0000-0000-0000-000000000001")

    prev_loc = Location(
        id=100,
        device_id=1,
        latitude=18.540000,
        longitude=73.856744,
        speed=20.0,
        timestamp=datetime.now(timezone.utc)
    )

    curr_in = LocationCreate(
        latitude=18.520430,
        longitude=73.856744,
        speed=15.0,
        timestamp=datetime.now(timezone.utc)
    )

    mock_db = _setup_mock_db(prev_loc, [])
    location, alerts, *_ = LocationService.ingest_location(mock_db, mock_device, curr_in)

    assert location is not None
    assert len(alerts) == 0

def test_overspeed_detection_and_duplicate_suppression():
    """Test overspeed alert when exceeding threshold, and duplicate suppression on consecutive speeding."""
    mock_device = Device(id=1, device_id="TEST-DEV-1", user_id="00000000-0000-0000-0000-000000000001")

    prev_loc_normal = Location(
        id=100,
        device_id=1,
        latitude=18.520430,
        longitude=73.856744,
        speed=45.0,
        timestamp=datetime.now(timezone.utc)
    )

    curr_in_overspeed = LocationCreate(
        latitude=18.521000,
        longitude=73.856744,
        speed=95.5,
        timestamp=datetime.now(timezone.utc)
    )

    mock_db = _setup_mock_db(prev_loc_normal, [])
    loc1, alerts1, *_ = LocationService.ingest_location(mock_db, mock_device, curr_in_overspeed)
    assert len(alerts1) == 1
    assert alerts1[0].type == "OVERSPEED"
    assert "95.5 km/h" in alerts1[0].message

    # 2. Overspeed -> Still Overspeed (Consecutive ping) -> Should NOT generate duplicate alert
    prev_loc_overspeed = Location(
        id=101,
        device_id=1,
        latitude=18.521000,
        longitude=73.856744,
        speed=95.5,
        timestamp=datetime.now(timezone.utc)
    )

    curr_in_still_speeding = LocationCreate(
        latitude=18.522000,
        longitude=73.856744,
        speed=92.0,
        timestamp=datetime.now(timezone.utc)
    )

    mock_db2 = _setup_mock_db(prev_loc_overspeed, [])
    loc2, alerts2, *_ = LocationService.ingest_location(mock_db2, mock_device, curr_in_still_speeding)
    assert len(alerts2) == 0
