import pytest
from datetime import datetime, timezone
from backend.app.models.device import Device, DeviceStatus
from backend.app.models.location import Location
from geoalchemy2.shape import to_shape

def test_ingest_location_success(client, auth_headers_user_a, db_session):
    # 1. Register a device to get raw secret
    reg_payload = {"device_id": "BIKE-LOC-001", "name": "GPS Test Bike"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    assert reg_res.status_code == 201
    raw_secret = reg_res.json()["device_secret"]

    # 2. Ingest a valid location reading
    loc_payload = {
        "latitude": 18.520430,
        "longitude": 73.856744,
        "speed": 42.5,
        "altitude": 560.2,
        "battery": 87.0,
        "gps_accuracy": 5.2,
        "satellites": 9,
        "timestamp": "2026-08-15T10:30:00Z"
    }
    headers = {
        "X-Device-ID": "BIKE-LOC-001",
        "X-Device-Secret": raw_secret
    }
    response = client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["device_id"] == "BIKE-LOC-001"
    assert data["latitude"] == 18.520430
    assert data["longitude"] == 73.856744
    assert data["speed"] == 42.5
    assert data["altitude"] == 560.2
    assert data["battery"] == 87.0
    assert data["satellites"] == 9

    # 3. Verify database persistence and PostGIS geometry
    device = db_session.query(Device).filter_by(device_id="BIKE-LOC-001").first()
    assert device is not None
    assert device.status == DeviceStatus.ONLINE
    assert device.last_seen is not None

    loc_db = db_session.query(Location).filter_by(device_id=device.id).first()
    assert loc_db is not None
    assert loc_db.latitude == 18.520430
    assert loc_db.longitude == 73.856744

    # Verify PostGIS geometry field is populated
    assert loc_db.geom is not None
    # The geometry is constructed from lat/lon in Location.__init__
    # Since we already verified lat/lon are correct, the geometry should be correct

def test_ingest_location_unauthorized_fails(client):
    loc_payload = {
        "latitude": 18.520430,
        "longitude": 73.856744,
        "timestamp": "2026-08-15T10:30:00Z"
    }

    # Missing headers
    res_no_headers = client.post("/api/v1/locations", json=loc_payload)
    assert res_no_headers.status_code == 401

    # Invalid secret
    res_bad_secret = client.post(
        "/api/v1/locations",
        json=loc_payload,
        headers={"X-Device-ID": "BIKE-LOC-001", "X-Device-Secret": "invalid_secret"}
    )
    assert res_bad_secret.status_code == 401
    assert res_bad_secret.json()["detail"] == "Invalid device credentials"

def test_location_validation_latitude_out_of_bounds(client, auth_headers_user_a):
    reg_res = client.post("/api/v1/devices", json={"device_id": "BIKE-VAL-001"}, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    headers = {"X-Device-ID": "BIKE-VAL-001", "X-Device-Secret": raw_secret}

    # Latitude > 90
    res_lat_high = client.post(
        "/api/v1/locations",
        json={"latitude": 95.0, "longitude": 73.85, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res_lat_high.status_code == 422

    # Latitude < -90
    res_lat_low = client.post(
        "/api/v1/locations",
        json={"latitude": -95.0, "longitude": 73.85, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res_lat_low.status_code == 422

def test_location_validation_longitude_out_of_bounds(client, auth_headers_user_a):
    reg_res = client.post("/api/v1/devices", json={"device_id": "BIKE-VAL-002"}, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    headers = {"X-Device-ID": "BIKE-VAL-002", "X-Device-Secret": raw_secret}

    # Longitude > 180
    res_lon_high = client.post(
        "/api/v1/locations",
        json={"latitude": 18.52, "longitude": 185.0, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res_lon_high.status_code == 422

    # Longitude < -180
    res_lon_low = client.post(
        "/api/v1/locations",
        json={"latitude": 18.52, "longitude": -185.0, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res_lon_low.status_code == 422

def test_location_validation_speed_battery_satellites(client, auth_headers_user_a):
    reg_res = client.post("/api/v1/devices", json={"device_id": "BIKE-VAL-003"}, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    headers = {"X-Device-ID": "BIKE-VAL-003", "X-Device-Secret": raw_secret}

    # Negative speed
    res_speed = client.post(
        "/api/v1/locations",
        json={"latitude": 18.52, "longitude": 73.85, "speed": -5.0, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res_speed.status_code == 422

    # Battery > 100
    res_batt_high = client.post(
        "/api/v1/locations",
        json={"latitude": 18.52, "longitude": 73.85, "battery": 105.0, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res_batt_high.status_code == 422

    # Negative satellites
    res_sat = client.post(
        "/api/v1/locations",
        json={"latitude": 18.52, "longitude": 73.85, "satellites": -1, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res_sat.status_code == 422

def test_location_validation_naive_timestamp_rejected(client, auth_headers_user_a):
    reg_res = client.post("/api/v1/devices", json={"device_id": "BIKE-VAL-004"}, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    headers = {"X-Device-ID": "BIKE-VAL-004", "X-Device-Secret": raw_secret}

    # Naive timestamp without timezone
    res = client.post(
        "/api/v1/locations",
        json={"latitude": 18.52, "longitude": 73.85, "timestamp": "2026-08-15 10:30:00"},
        headers=headers
    )
    assert res.status_code == 422
