import pytest
from uuid import uuid4
from backend.app.models.device import Device
from backend.app.models.geofence import Geofence

def test_create_geofence_api(client, auth_headers_user_a, db_session, test_user_a_uuid):
    # 1. Register device for user A
    device = Device(device_id="BIKE-GEO-API-1", name="Geo Bike", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()

    # 2. Create geofence via POST
    payload = {
        "name": "Home Zone",
        "latitude": 18.520430,
        "longitude": 73.856744,
        "radius": 400.0,
        "enabled": True
    }
    res = client.post("/api/v1/geofences/BIKE-GEO-API-1", json=payload, headers=auth_headers_user_a)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Home Zone"
    assert data["latitude"] == 18.520430
    assert data["longitude"] == 73.856744
    assert data["radius"] == 400.0
    assert data["enabled"] is True
    assert data["device_id"] == "BIKE-GEO-API-1"
    assert "id" in data
    # Ensure no secret hash in response
    assert "device_secret" not in data
    assert "device_secret_hash" not in data

def test_list_and_manage_geofences_api(client, auth_headers_user_a, db_session, test_user_a_uuid):
    device = Device(device_id="BIKE-GEO-API-2", name="Geo Bike 2", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()

    # Create 2 geofences
    client.post(
        "/api/v1/geofences/BIKE-GEO-API-2",
        json={"name": "Zone A", "latitude": 18.52, "longitude": 73.85, "radius": 200.0},
        headers=auth_headers_user_a
    )
    res_b = client.post(
        "/api/v1/geofences/BIKE-GEO-API-2",
        json={"name": "Zone B", "latitude": 18.53, "longitude": 73.86, "radius": 500.0},
        headers=auth_headers_user_a
    )
    geo_b_id = res_b.json()["id"]

    # List geofences
    list_res = client.get("/api/v1/geofences/BIKE-GEO-API-2", headers=auth_headers_user_a)
    assert list_res.status_code == 200
    geos = list_res.json()
    assert len(geos) == 2

    # Disable Zone B
    disable_res = client.patch(f"/api/v1/geofences/BIKE-GEO-API-2/{geo_b_id}/disable", headers=auth_headers_user_a)
    assert disable_res.status_code == 200
    assert disable_res.json()["enabled"] is False

    # Enable Zone B
    enable_res = client.patch(f"/api/v1/geofences/BIKE-GEO-API-2/{geo_b_id}/enable", headers=auth_headers_user_a)
    assert enable_res.status_code == 200
    assert enable_res.json()["enabled"] is True

    # Delete Zone B
    del_res = client.delete(f"/api/v1/geofences/BIKE-GEO-API-2/{geo_b_id}", headers=auth_headers_user_a)
    assert del_res.status_code == 200

    # Verify 1 remains
    list_after = client.get("/api/v1/geofences/BIKE-GEO-API-2", headers=auth_headers_user_a)
    assert len(list_after.json()) == 1

def test_geofence_cross_user_isolation(client, auth_headers_user_a, auth_headers_user_b, db_session, test_user_a_uuid):
    # Device belongs to User A
    device = Device(device_id="BIKE-GEO-USER-A", name="User A Bike", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()

    # User B attempts to create geofence on User A's device -> 403 Forbidden
    payload = {"name": "Hacker Zone", "latitude": 18.52, "longitude": 73.85, "radius": 300.0}
    res = client.post("/api/v1/geofences/BIKE-GEO-USER-A", json=payload, headers=auth_headers_user_b)
    assert res.status_code == 403

    # User B attempts to list geofences on User A's device -> 403 Forbidden
    res_list = client.get("/api/v1/geofences/BIKE-GEO-USER-A", headers=auth_headers_user_b)
    assert res_list.status_code == 403
