"""Tests for GET /api/v1/trips/{device_id} (read-only trip history)."""
from datetime import datetime, timezone, timedelta
from backend.app.models.device import Device
from backend.app.models.trip import Trip


def _register_device(client, auth_headers, device_id):
    reg = client.post(
        "/api/v1/devices",
        json={"device_id": device_id, "name": f"Trip Bike {device_id}"},
        headers=auth_headers,
    )
    assert reg.status_code == 201
    return reg.json()


def _insert_trip(db_session, device_db_id, start, distance=5.0, max_speed=30.0, avg_speed=15.0, end=None, duration=None):
    trip = Trip(
        device_id=device_db_id,
        start_time=start,
        end_time=end,
        distance=distance,
        duration=duration,
        max_speed=max_speed,
        average_speed=avg_speed,
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)
    return trip


def test_trips_requires_auth(client):
    res = client.get("/api/v1/trips/BIKE-TRIP-001")
    assert res.status_code in (401, 403)


def test_trips_retrieval_success(client, auth_headers_user_a, db_session):
    _register_device(client, auth_headers_user_a, "BIKE-TRIP-OK")
    device = db_session.query(Device).filter_by(device_id="BIKE-TRIP-OK").first()
    assert device is not None

    start1 = datetime(2026, 8, 14, 8, 0, 0, tzinfo=timezone.utc)
    start2 = datetime(2026, 8, 15, 9, 0, 0, tzinfo=timezone.utc)
    _insert_trip(
        db_session,
        device.id,
        start1,
        distance=10.5,
        max_speed=40.0,
        avg_speed=18.0,
        end=start1 + timedelta(hours=1),
        duration=timedelta(hours=1),
    )
    _insert_trip(
        db_session,
        device.id,
        start2,
        distance=3.2,
        max_speed=25.0,
        avg_speed=12.0,
        end=start2 + timedelta(minutes=30),
        duration=timedelta(minutes=30),
    )

    res = client.get("/api/v1/trips/BIKE-TRIP-OK", headers=auth_headers_user_a)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2

    # Newest start_time first
    assert data[0]["start_time"] >= data[1]["start_time"]

    trip = data[0]
    assert trip["device_id"] == "BIKE-TRIP-OK"
    assert "distance" in trip
    assert "duration" in trip
    assert "max_speed" in trip
    assert "average_speed" in trip
    assert "start_time" in trip
    assert "end_time" in trip
    assert "device_secret" not in trip
    assert trip["duration"] == "00:30:00"


def test_trips_ownership_isolation(client, auth_headers_user_a, auth_headers_user_b, db_session):
    _register_device(client, auth_headers_user_a, "BIKE-TRIP-A")
    _register_device(client, auth_headers_user_b, "BIKE-TRIP-B")

    device_a = db_session.query(Device).filter_by(device_id="BIKE-TRIP-A").first()
    _insert_trip(
        db_session,
        device_a.id,
        datetime(2026, 8, 15, 10, 0, 0, tzinfo=timezone.utc),
        distance=7.0,
    )

    # Owner can read
    res_a = client.get("/api/v1/trips/BIKE-TRIP-A", headers=auth_headers_user_a)
    assert res_a.status_code == 200
    assert len(res_a.json()) == 1

    # Other user cannot
    res_cross = client.get("/api/v1/trips/BIKE-TRIP-A", headers=auth_headers_user_b)
    assert res_cross.status_code == 403
    assert "access denied" in res_cross.json()["detail"].lower()


def test_trips_empty_list(client, auth_headers_user_a):
    _register_device(client, auth_headers_user_a, "BIKE-TRIP-EMPTY")
    res = client.get("/api/v1/trips/BIKE-TRIP-EMPTY", headers=auth_headers_user_a)
    assert res.status_code == 200
    assert res.json() == []


def test_trips_device_not_found(client, auth_headers_user_a):
    res = client.get("/api/v1/trips/NO-SUCH-DEVICE", headers=auth_headers_user_a)
    assert res.status_code == 404


def test_trips_limit(client, auth_headers_user_a, db_session):
    _register_device(client, auth_headers_user_a, "BIKE-TRIP-LIM")
    device = db_session.query(Device).filter_by(device_id="BIKE-TRIP-LIM").first()
    base = datetime(2026, 8, 10, 8, 0, 0, tzinfo=timezone.utc)
    for i in range(5):
        _insert_trip(db_session, device.id, base + timedelta(hours=i), distance=float(i + 1))

    res = client.get(
        "/api/v1/trips/BIKE-TRIP-LIM?limit=2",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    assert len(res.json()) == 2
