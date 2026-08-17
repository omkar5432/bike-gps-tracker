import pytest
from backend.app.models.device import Device, DeviceStatus

def test_device_authentication_valid_credentials(client, auth_headers_user_a, db_session):
    # 1. Register device to get secret
    reg_payload = {"device_id": "BIKE-AUTH-001", "name": "Auth Bike"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    assert reg_res.status_code == 201
    raw_secret = reg_res.json()["device_secret"]

    # 2. Authenticate using X-Device-ID and X-Device-Secret headers
    headers = {
        "X-Device-ID": "BIKE-AUTH-001",
        "X-Device-Secret": raw_secret
    }
    auth_res = client.post("/api/v1/devices/auth/verify", headers=headers)
    assert auth_res.status_code == 200
    data = auth_res.json()
    assert data["status"] == "authenticated"
    assert data["device_id"] == "BIKE-AUTH-001"
    assert data["device_status"] == DeviceStatus.ONLINE
    assert data["last_seen"] is not None

def test_device_authentication_invalid_secret_fails(client, auth_headers_user_a):
    reg_payload = {"device_id": "BIKE-AUTH-002", "name": "Auth Bike 2"}
    reg_res = client.post("/api/v1/devices", json=reg_payload, headers=auth_headers_user_a)
    assert reg_res.status_code == 201

    headers = {
        "X-Device-ID": "BIKE-AUTH-002",
        "X-Device-Secret": "wrong_secret_12345"
    }
    auth_res = client.post("/api/v1/devices/auth/verify", headers=headers)
    assert auth_res.status_code == 401
    assert auth_res.json()["detail"] == "Invalid device credentials"

def test_device_authentication_unknown_device_fails(client):
    headers = {
        "X-Device-ID": "UNKNOWN-DEVICE-999",
        "X-Device-Secret": "any_random_secret"
    }
    auth_res = client.post("/api/v1/devices/auth/verify", headers=headers)
    assert auth_res.status_code == 401
    assert auth_res.json()["detail"] == "Invalid device credentials"

def test_device_authentication_missing_headers_fails(client):
    auth_res = client.post("/api/v1/devices/auth/verify")
    assert auth_res.status_code == 401
    assert "missing" in auth_res.json()["detail"].lower()
