import pytest
import uuid
from backend.app.models.device import Device, DeviceStatus
from backend.app.core.security import verify_device_secret

def test_register_device_success(client, auth_headers_user_a, test_user_a_uuid, db_session):
    # Use unique device_id and imei to avoid conflicts with existing data
    unique_device_id = f"BIKE-REG-{uuid.uuid4().hex[:8]}"
    unique_imei = f"354{uuid.uuid4().hex[:12]}"
    payload = {
        "device_id": unique_device_id,
        "name": "Commuter Bike",
        "imei": unique_imei
    }
    response = client.post("/api/v1/devices", json=payload, headers=auth_headers_user_a)
    assert response.status_code == 201
    data = response.json()
    assert data["device_id"] == unique_device_id
    assert data["name"] == "Commuter Bike"
    assert data["imei"] == unique_imei
    assert data["status"] == DeviceStatus.OFFLINE
    assert "device_secret" in data
    raw_secret = data["device_secret"]
    assert len(raw_secret) > 20

    # Verify database state
    saved_device = db_session.query(Device).filter_by(device_id=unique_device_id).first()
    assert saved_device is not None
    assert saved_device.user_id == test_user_a_uuid
    assert saved_device.device_secret_hash is not None
    assert saved_device.device_secret_hash != raw_secret
    # Verify hash verification passes
    assert verify_device_secret(raw_secret, saved_device.device_secret_hash) is True

def test_register_duplicate_device_id_fails(client, auth_headers_user_a):
    # Use unique device_id to avoid conflicts with existing data
    unique_device_id = f"BIKE-DUP-{uuid.uuid4().hex[:8]}"
    payload = {
        "device_id": unique_device_id,
        "name": "Bike One"
    }
    res1 = client.post("/api/v1/devices", json=payload, headers=auth_headers_user_a)
    assert res1.status_code == 201

    # Attempt to register identical device_id
    res2 = client.post("/api/v1/devices", json=payload, headers=auth_headers_user_a)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"].lower()

def test_register_duplicate_imei_fails(client, auth_headers_user_a):
    # Use unique device_id to avoid conflicts with existing data
    unique_imei = f"860{uuid.uuid4().hex[:12]}"
    payload1 = {
        "device_id": f"BIKE-IMEI-1-{uuid.uuid4().hex[:8]}",
        "name": "Bike One",
        "imei": unique_imei
    }
    res1 = client.post("/api/v1/devices", json=payload1, headers=auth_headers_user_a)
    assert res1.status_code == 201

    payload2 = {
        "device_id": f"BIKE-IMEI-2-{uuid.uuid4().hex[:8]}",
        "name": "Bike Two",
        "imei": unique_imei
    }
    res2 = client.post("/api/v1/devices", json=payload2, headers=auth_headers_user_a)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"].lower()

def test_register_device_unauthenticated_fails(client):
    # Use unique device_id to avoid conflicts with existing data
    unique_device_id = f"BIKE-NOAUTH-{uuid.uuid4().hex[:8]}"
    payload = {
        "device_id": unique_device_id,
        "name": "No Auth Bike"
    }
    res = client.post("/api/v1/devices", json=payload)
    assert res.status_code == 401
