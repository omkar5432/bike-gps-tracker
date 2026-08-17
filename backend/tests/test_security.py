import pytest
from datetime import timedelta
from backend.app.core.security import create_access_token

def test_secret_and_hash_never_exposed_in_get_or_list(client, auth_headers_user_a):
    # Register device
    reg_res = client.post(
        "/api/v1/devices",
        json={"device_id": "BIKE-SEC-001", "name": "Secure Bike"},
        headers=auth_headers_user_a
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "device_secret" in reg_data
    assert "device_secret_hash" not in reg_data

    # List endpoint
    list_res = client.get("/api/v1/devices", headers=auth_headers_user_a)
    assert list_res.status_code == 200
    for device in list_res.json():
        assert "device_secret" not in device
        assert "device_secret_hash" not in device

    # Detail GET endpoint
    get_res = client.get("/api/v1/devices/BIKE-SEC-001", headers=auth_headers_user_a)
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert "device_secret" not in get_data
    assert "device_secret_hash" not in get_data

def test_invalid_jwt_signature_rejected(client):
    invalid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature"
    headers = {"Authorization": f"Bearer {invalid_token}"}
    res = client.get("/api/v1/devices", headers=headers)
    assert res.status_code == 401
    assert "invalid or expired" in res.json()["detail"].lower()

def test_expired_jwt_rejected(client, test_user_a_uuid):
    expired_token = create_access_token(
        {"sub": test_user_a_uuid, "email": "test@example.com"},
        expires_delta=timedelta(seconds=-60)
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    res = client.get("/api/v1/devices", headers=headers)
    assert res.status_code == 401
    assert "invalid or expired" in res.json()["detail"].lower()
