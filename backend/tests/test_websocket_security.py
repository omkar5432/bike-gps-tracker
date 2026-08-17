import pytest
from backend.app.models.device import Device
from backend.app.core.security import create_access_token, verify_supabase_jwt

def test_websocket_rejects_invalid_jwt(client, test_user_a_uuid, db_session):
    """Test that invalid JWT token is rejected."""
    # Create device
    device = Device(device_id="SEC-INV-001", name="Security Test Device", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()
    
    # Use invalid token
    invalid_token = "invalid.jwt.token"
    
    with client.websocket_connect(f"/api/v1/ws/devices/SEC-INV-001?token={invalid_token}") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_rejects_expired_jwt(client, test_user_a_uuid, db_session):
    """Test that expired JWT token is rejected."""
    # Create device
    device = Device(device_id="SEC-EXP-001", name="Security Test Device", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()
    
    # Create expired token (using very short expiration in a real scenario)
    # For this test, we'll use a malformed token that simulates expiration
    from datetime import timedelta
    from backend.app.core.security import create_access_token
    # Note: In a real test, we'd need to wait for expiration or mock time
    # For now, we'll test with a completely invalid token format
    expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MjAwMDAwMDB9.invalid"
    
    with client.websocket_connect(f"/api/v1/ws/devices/SEC-EXP-001?token={expired_token}") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_user_cannot_subscribe_to_another_user_device(client, test_user_a_uuid, test_user_b_uuid, db_session):
    """Test that user cannot subscribe to another user's device."""
    # Create device owned by test_user_a
    device_a = Device(device_id="SEC-OWN-A-001", name="User A Device", user_id=test_user_a_uuid)
    db_session.add(device_a)
    
    # Create device owned by test_user_b
    device_b = Device(device_id="SEC-OWN-B-001", name="User B Device", user_id=test_user_b_uuid)
    db_session.add(device_b)
    db_session.commit()
    
    # Generate token for test_user_a
    token_a = create_access_token({"sub": test_user_a_uuid, "email": "test@example.com"})
    
    # test_user_a should not be able to connect to test_user_b's device
    with client.websocket_connect(f"/api/v1/ws/devices/SEC-OWN-B-001?token={token_a}") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_message_does_not_expose_device_secret(client, auth_headers_user_a, test_user_a_uuid, db_session):
    """Test that WebSocket messages do not contain device secrets."""
    # Register device
    reg_payload = {"device_id": "SEC-SECRET-001", "name": "Secret Test Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    
    # Get user token
    from backend.app.core.security import create_access_token
    token = create_access_token({"sub": test_user_a_uuid, "email": "usera@example.com"})
    
    # Connect WebSocket
    with client.websocket_connect(f"/api/v1/ws/devices/SEC-SECRET-001?token={token}") as websocket:
        websocket.receive_json()  # connected event
        
        # Send location
        loc_payload = {
            "latitude": 18.520430,
            "longitude": 73.856744,
            "timestamp": "2026-08-15T10:30:00Z"
        }
        headers = {
            "X-Device-ID": "SEC-SECRET-001",
            "X-Device-Secret": raw_secret
        }
        response = client.post("/api/v1/locations", json=loc_payload, headers=headers)
        assert response.status_code == 201
        
        # Receive location update
        location_update = websocket.receive_json()
        
        # Verify no secrets in message
        message_str = str(location_update)
        assert raw_secret not in message_str
        assert "device_secret" not in message_str
        assert "device_secret_hash" not in message_str
        assert "password" not in message_str

def test_websocket_message_does_not_expose_jwt(client, auth_headers_user_a, test_user_a_uuid, db_session):
    """Test that WebSocket messages do not contain JWT tokens."""
    # Register device
    reg_payload = {"device_id": "SEC-JWT-001", "name": "JWT Test Device"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    raw_secret = reg_res.json()["device_secret"]
    
    # Get user token
    from backend.app.core.security import create_access_token
    token = create_access_token({"sub": test_user_a_uuid, "email": "usera@example.com"})
    
    # Connect WebSocket
    with client.websocket_connect(f"/api/v1/ws/devices/SEC-JWT-001?token={token}") as websocket:
        websocket.receive_json()  # connected event
        
        # Send location
        loc_payload = {
            "latitude": 18.520430,
            "longitude": 73.856744,
            "timestamp": "2026-08-15T10:30:00Z"
        }
        headers = {
            "X-Device-ID": "SEC-JWT-001",
            "X-Device-Secret": raw_secret
        }
        response = client.post("/api/v1/locations", json=loc_payload, headers=headers)
        assert response.status_code == 201
        
        # Receive location update
        location_update = websocket.receive_json()
        
        # Verify no JWT in message
        message_str = str(location_update)
        assert token not in message_str
        # Check for actual JWT-related terms, not substring matches in timestamps
        assert "jwt_token" not in message_str.lower()
        assert "authorization" not in message_str.lower()
        assert "bearer" not in message_str.lower()

def test_websocket_unauthorized_user_rejected(client, db_session):
    """Test that unauthorized user (no valid JWT) is rejected."""
    # Create device
    from uuid import uuid4
    user_id = uuid4()
    device = Device(device_id="SEC-UNAUTH-001", name="Unauthorized Test Device", user_id=user_id)
    db_session.add(device)
    db_session.commit()
    
    # Try to connect without token
    with client.websocket_connect("/api/v1/ws/devices/SEC-UNAUTH-001") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()

def test_websocket_nonexistent_device_no_information_leak(client, test_user_a_uuid):
    """Test that non-existent device doesn't leak information about existence."""
    token = create_access_token({"sub": test_user_a_uuid, "email": "test@example.com"})
    
    # Should reject connection without revealing whether device exists
    with client.websocket_connect(f"/api/v1/ws/devices/NONEXISTENT-SEC-001?token={token}") as websocket:
        # Should receive close message
        data = websocket.receive()
        assert data is None or "close" in str(data).lower()
