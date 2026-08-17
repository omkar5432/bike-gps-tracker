"""Tests for GET /api/v1/locations/{device_id}/history"""
from datetime import datetime, timezone, timedelta


def _register_and_ingest(client, auth_headers, device_id, count=3, base_lat=18.52):
    """Register device and ingest `count` locations with increasing timestamps."""
    reg = client.post(
        "/api/v1/devices",
        json={"device_id": device_id, "name": f"Bike {device_id}"},
        headers=auth_headers,
    )
    assert reg.status_code == 201
    secret = reg.json()["device_secret"]
    device_headers = {"X-Device-ID": device_id, "X-Device-Secret": secret}

    base_time = datetime(2026, 8, 15, 10, 0, 0, tzinfo=timezone.utc)
    for i in range(count):
        payload = {
            "latitude": base_lat + (i * 0.001),
            "longitude": 73.856744,
            "speed": 10.0 + i,
            "battery": 90.0 - i,
            "altitude": 560.0,
            "gps_accuracy": 5.0,
            "satellites": 8,
            "timestamp": (base_time + timedelta(minutes=i)).isoformat().replace("+00:00", "Z"),
        }
        res = client.post("/api/v1/locations", json=payload, headers=device_headers)
        assert res.status_code == 201

    return secret


def test_location_history_requires_auth(client):
    res = client.get("/api/v1/locations/BIKE-HIST-001/history")
    assert res.status_code in (401, 403)


def test_location_history_success_ordering(client, auth_headers_user_a):
    _register_and_ingest(client, auth_headers_user_a, "BIKE-HIST-ORD", count=5)

    res = client.get(
        "/api/v1/locations/BIKE-HIST-ORD/history",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 5

    # Newest first
    timestamps = [item["timestamp"] for item in data]
    assert timestamps == sorted(timestamps, reverse=True)

    # Required fields present; no secrets
    first = data[0]
    for key in (
        "id",
        "device_id",
        "latitude",
        "longitude",
        "speed",
        "altitude",
        "battery",
        "gps_accuracy",
        "satellites",
        "timestamp",
    ):
        assert key in first
    assert first["device_id"] == "BIKE-HIST-ORD"
    assert "device_secret" not in first
    assert "device_secret_hash" not in first


def test_location_history_limit(client, auth_headers_user_a):
    _register_and_ingest(client, auth_headers_user_a, "BIKE-HIST-LIM", count=10)

    res = client.get(
        "/api/v1/locations/BIKE-HIST-LIM/history?limit=3",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    assert len(res.json()) == 3


def test_location_history_default_limit_caps_large_sets(client, auth_headers_user_a):
    # Default limit is 100; ingest fewer to confirm default returns all available
    _register_and_ingest(client, auth_headers_user_a, "BIKE-HIST-DEF", count=4)
    res = client.get(
        "/api/v1/locations/BIKE-HIST-DEF/history",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    assert len(res.json()) == 4


def test_location_history_ownership_isolation(client, auth_headers_user_a, auth_headers_user_b):
    _register_and_ingest(client, auth_headers_user_a, "BIKE-HIST-A", count=2)
    _register_and_ingest(client, auth_headers_user_b, "BIKE-HIST-B", count=2)

    # Owner can read
    res_a = client.get(
        "/api/v1/locations/BIKE-HIST-A/history",
        headers=auth_headers_user_a,
    )
    assert res_a.status_code == 200
    assert len(res_a.json()) == 2

    # Other user cannot
    res_cross = client.get(
        "/api/v1/locations/BIKE-HIST-A/history",
        headers=auth_headers_user_b,
    )
    assert res_cross.status_code == 403
    assert "access denied" in res_cross.json()["detail"].lower()


def test_location_history_device_not_found(client, auth_headers_user_a):
    res = client.get(
        "/api/v1/locations/MISSING-DEVICE/history",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 404


def test_location_history_empty(client, auth_headers_user_a):
    reg = client.post(
        "/api/v1/devices",
        json={"device_id": "BIKE-HIST-EMPTY", "name": "Empty Bike"},
        headers=auth_headers_user_a,
    )
    assert reg.status_code == 201

    res = client.get(
        "/api/v1/locations/BIKE-HIST-EMPTY/history",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    assert res.json() == []


def test_location_history_invalid_limit(client, auth_headers_user_a):
    reg = client.post(
        "/api/v1/devices",
        json={"device_id": "BIKE-HIST-BADLIM", "name": "Limit Bike"},
        headers=auth_headers_user_a,
    )
    assert reg.status_code == 201

    res_zero = client.get(
        "/api/v1/locations/BIKE-HIST-BADLIM/history?limit=0",
        headers=auth_headers_user_a,
    )
    assert res_zero.status_code == 422

    res_over = client.get(
        "/api/v1/locations/BIKE-HIST-BADLIM/history?limit=9999",
        headers=auth_headers_user_a,
    )
    assert res_over.status_code == 422
