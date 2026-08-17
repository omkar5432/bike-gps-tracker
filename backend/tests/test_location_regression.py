import pytest
from datetime import datetime, timezone
from backend.app.models.device import Device, DeviceStatus
from backend.app.models.location import Location

def test_location_api_still_works_without_websocket_manager(client, auth_headers_user_a, db_session):
    """Test that location API works normally even if WebSocket broadcast fails."""
    # Register device
    reg_payload = {"device_id": "REG-NO-WS-001", "name": "Regression Test Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    assert reg_res.status_code == 201
    raw_secret = reg_res.json()["device_secret"]
    
    # Send location - should succeed even with no WebSocket clients
    loc_payload = {
        "latitude": 18.520430,
        "longitude": 73.856744,
        "speed": 42.5,
        "timestamp": "2026-08-15T10:30:00Z"
    }
    headers = {
        "X-Device-ID": "REG-NO-WS-001",
        "X-Device-Secret": raw_secret
    }
    response = client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert response.status_code == 201
    
    # Verify location was persisted
    device = db_session.query(Device).filter(Device.device_id == "REG-NO-WS-001").first()
    location = db_session.query(Location).filter(Location.device_id == device.id).first()
    assert location is not None
    assert location.latitude == 18.520430

def test_location_validation_still_works_with_websocket(client, auth_headers_user_a):
    """Test that location validation still works after WebSocket integration."""
    # Register device
    reg_res = client.post("/api/v1/devices", json={"device_id": "REG-VAL-001"}, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    headers = {"X-Device-ID": "REG-VAL-001", "X-Device-Secret": raw_secret}
    
    # Invalid latitude should still be rejected
    res = client.post(
        "/api/v1/locations",
        json={"latitude": 95.0, "longitude": 73.85, "timestamp": "2026-08-15T10:30:00Z"},
        headers=headers
    )
    assert res.status_code == 422

def test_device_authentication_still_works_with_websocket(client, auth_headers_user_a):
    """Test that device authentication still works after WebSocket integration."""
    # Register device
    reg_res = client.post("/api/v1/devices", json={"device_id": "REG-AUTH-001"}, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    
    # Valid device authentication should work
    headers = {"X-Device-ID": "REG-AUTH-001", "X-Device-Secret": raw_secret}
    loc_payload = {"latitude": 18.52, "longitude": 73.85, "timestamp": "2026-08-15T10:30:00Z"}
    res = client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert res.status_code == 201
    
    # Invalid device authentication should fail
    bad_headers = {"X-Device-ID": "REG-AUTH-001", "X-Device-Secret": "wrong_secret"}
    res = client.post("/api/v1/locations", json=loc_payload, headers=bad_headers)
    assert res.status_code == 401

def test_location_updates_device_status_with_websocket(client, auth_headers_user_a, db_session):
    """Test that device status is still updated to ONLINE when location is received."""
    # Register device
    reg_payload = {"device_id": "REG-STATUS-001", "name": "Status Test Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    
    # Device should start as OFFLINE
    device = db_session.query(Device).filter(Device.device_id == "REG-STATUS-001").first()
    assert device.status == DeviceStatus.OFFLINE
    
    # Send location
    headers = {"X-Device-ID": "REG-STATUS-001", "X-Device-Secret": raw_secret}
    loc_payload = {"latitude": 18.52, "longitude": 73.85, "timestamp": "2026-08-15T10:30:00Z"}
    res = client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert res.status_code == 201
    
    # Device should now be ONLINE
    db_session.refresh(device)
    assert device.status == DeviceStatus.ONLINE
    assert device.last_seen is not None

def test_location_updates_last_seen_with_websocket(client, auth_headers_user_a, db_session):
    """Test that device last_seen is still updated when location is received."""
    # Register device
    reg_payload = {"device_id": "REG-LAST-001", "name": "Last Seen Test Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    
    # Send location
    headers = {"X-Device-ID": "REG-LAST-001", "X-Device-Secret": raw_secret}
    timestamp = "2026-08-15T10:30:00Z"
    loc_payload = {"latitude": 18.52, "longitude": 73.85, "timestamp": timestamp}
    res = client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert res.status_code == 201
    
    # last_seen should be updated
    device = db_session.query(Device).filter(Device.device_id == "REG-LAST-001").first()
    assert device.last_seen is not None

def test_failed_location_not_broadcast(client, auth_headers_user_a, db_session):
    """Test that failed location ingestion is not broadcast."""
    # Register device
    reg_res = client.post("/api/v1/devices", json={"device_id": "REG-FAIL-001"}, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    headers = {"X-Device-ID": "REG-FAIL-001", "X-Device-Secret": raw_secret}
    
    # Send invalid location (should fail)
    loc_payload = {"latitude": 95.0, "longitude": 73.85, "timestamp": "2026-08-15T10:30:00Z"}
    res = client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert res.status_code == 422
    
    # Invalid location should not be in database
    from backend.app.models.location import Location
    from backend.app.models.device import Device
    device = db_session.query(Device).filter(Device.device_id == "REG-FAIL-001").first()
    location = db_session.query(Location).filter(Location.device_id == device.id).first()
    assert location is None
