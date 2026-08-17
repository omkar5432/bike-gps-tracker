import pytest
import asyncio
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from backend.app.models.device import Device
from backend.app.core.security import create_access_token
from backend.app.websocket.manager import manager

def test_websocket_connection_valid_authentication(client, test_user_a_uuid, db_session):
    """Test that valid JWT authentication allows WebSocket connection."""
    # Create a device owned by test_user_a
    device = Device(device_id="WS-TEST-001", name="WebSocket Test Device", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()
    
    # Generate valid JWT token
    token = create_access_token({"sub": test_user_a_uuid, "email": "test@example.com"})
    
    # Connect to WebSocket
    with client.websocket_connect(f"/api/v1/ws/devices/WS-TEST-001?token={token}") as websocket:
        # Should receive connected event
        data = websocket.receive_json()
        assert data["event"] == "connected"
        assert data["data"]["device_id"] == "WS-TEST-001"

def test_websocket_connection_invalid_token(client):
    """Test that invalid JWT token is rejected."""
    with client.websocket_connect("/api/v1/ws/devices/WS-TEST-001?token=invalid_token") as websocket:
        # Should receive close message or connection should close
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_connection_missing_token(client):
    """Test that missing token is rejected."""
    with client.websocket_connect("/api/v1/ws/devices/WS-TEST-001") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_user_owns_device(client, test_user_a_uuid, test_user_b_uuid, db_session):
    """Test that user cannot connect to another user's device."""
    # Create device owned by test_user_a
    device = Device(device_id="WS-OWN-001", name="Owned Device", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()
    
    # Generate token for test_user_b (different user)
    token = create_access_token({"sub": test_user_b_uuid, "email": "test@example.com"})
    
    # test_user_b should not be able to connect to test_user_a's device
    with client.websocket_connect(f"/api/v1/ws/devices/WS-OWN-001?token={token}") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_nonexistent_device(client, test_user_a, db_session):
    """Test that connection to non-existent device fails."""
    token = create_access_token({"sub": "user-a-uuid", "email": test_user_a.email})
    
    with client.websocket_connect(f"/api/v1/ws/devices/NONEXISTENT?token={token}") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_location_broadcast(client, auth_headers_user_a, test_user_a_uuid, db_session):
    """Test that location updates are broadcast to WebSocket clients."""
    # Register a device
    reg_payload = {"device_id": "WS-LOC-001", "name": "Broadcast Test Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    assert reg_res.status_code == 201
    raw_secret = reg_res.json()["device_secret"]
    
    # Get user token for WebSocket
    from backend.app.core.security import create_access_token
    token = create_access_token({"sub": test_user_a_uuid, "email": "usera@example.com"})
    
    # Connect WebSocket client
    with client.websocket_connect(f"/api/v1/ws/devices/WS-LOC-001?token={token}") as websocket:
        # Wait for connected event
        connected = websocket.receive_json()
        assert connected["event"] == "connected"
        
        # Send location via HTTP API
        loc_payload = {
            "latitude": 18.520430,
            "longitude": 73.856744,
            "speed": 42.5,
            "timestamp": "2026-08-15T10:30:00Z"
        }
        headers = {
            "X-Device-ID": "WS-LOC-001",
            "X-Device-Secret": raw_secret
        }
        response = client.post("/api/v1/locations", json=loc_payload, headers=headers)
        assert response.status_code == 201
        
        # Receive location update via WebSocket
        location_update = websocket.receive_json()
        assert location_update["event"] == "location_update"
        assert location_update["data"]["device_id"] == "WS-LOC-001"
        assert location_update["data"]["latitude"] == 18.520430
        assert location_update["data"]["longitude"] == 73.856744
        assert location_update["data"]["speed"] == 42.5

def test_websocket_multiple_clients(client, auth_headers_user_a, test_user_a_uuid, db_session):
    """Test that multiple clients receive the same location update."""
    # Register device
    reg_payload = {"device_id": "WS-MULTI-001", "name": "Multi Client Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    
    # Get user token
    from backend.app.core.security import create_access_token
    token = create_access_token({"sub": test_user_a_uuid, "email": "usera@example.com"})
    
    # Connect multiple WebSocket clients
    with client.websocket_connect(f"/api/v1/ws/devices/WS-MULTI-001?token={token}") as ws1, \
         client.websocket_connect(f"/api/v1/ws/devices/WS-MULTI-001?token={token}") as ws2, \
         client.websocket_connect(f"/api/v1/ws/devices/WS-MULTI-001?token={token}") as ws3:
        
        # Wait for connected events
        ws1.receive_json()
        ws2.receive_json()
        ws3.receive_json()
        
        # Send location
        loc_payload = {
            "latitude": 18.520430,
            "longitude": 73.856744,
            "timestamp": "2026-08-15T10:30:00Z"
        }
        headers = {
            "X-Device-ID": "WS-MULTI-001",
            "X-Device-Secret": raw_secret
        }
        response = client.post("/api/v1/locations", json=loc_payload, headers=headers)
        assert response.status_code == 201
        
        # All clients should receive the update
        update1 = ws1.receive_json()
        update2 = ws2.receive_json()
        update3 = ws3.receive_json()
        
        assert update1["event"] == "location_update"
        assert update2["event"] == "location_update"
        assert update3["event"] == "location_update"
        
        assert update1["data"]["device_id"] == "WS-MULTI-001"
        assert update2["data"]["device_id"] == "WS-MULTI-001"
        assert update3["data"]["device_id"] == "WS-MULTI-001"

def test_websocket_disconnect_cleanup(client, auth_headers_user_a, test_user_a_uuid, db_session):
    """Test that disconnecting client is properly cleaned up."""
    # Register device
    reg_payload = {"device_id": "WS-DISC-001", "name": "Disconnect Test Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    
    # Get user token
    from backend.app.core.security import create_access_token
    token = create_access_token({"sub": test_user_a_uuid, "email": "usera@example.com"})
    
    # Connect and verify connection count
    with client.websocket_connect(f"/api/v1/ws/devices/WS-DISC-001?token={token}") as websocket:
        websocket.receive_json()  # connected event
        assert manager.get_connection_count("WS-DISC-001") == 1
    
    # After context exit, connection should be cleaned up
    assert manager.get_connection_count("WS-DISC-001") == 0

def test_location_persists_without_websocket_clients(client, auth_headers_user_a, db_session):
    """Test that location persists even when no WebSocket clients are connected."""
    # Register device
    reg_payload = {"device_id": "WS-NO-WS-001", "name": "No WebSocket Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    
    # Send location with no WebSocket clients
    loc_payload = {
        "latitude": 18.520430,
        "longitude": 73.856744,
        "timestamp": "2026-08-15T10:30:00Z"
    }
    headers = {
        "X-Device-ID": "WS-NO-WS-001",
        "X-Device-Secret": raw_secret
    }
    response = client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert response.status_code == 201
    
    # Verify location was persisted
    from backend.app.models.location import Location
    from backend.app.models.device import Device
    device = db_session.query(Device).filter(Device.device_id == "WS-NO-WS-001").first()
    location = db_session.query(Location).filter(Location.device_id == device.id).first()
    assert location is not None
    assert location.latitude == 18.520430
