import pytest

def test_device_ownership_isolation(client, auth_headers_user_a, auth_headers_user_b):
    # User A registers a device
    client.post(
        "/api/v1/devices",
        json={"device_id": "BIKE-USER-A", "name": "Alpha Bike"},
        headers=auth_headers_user_a
    )

    # User B registers a device
    client.post(
        "/api/v1/devices",
        json={"device_id": "BIKE-USER-B", "name": "Beta Bike"},
        headers=auth_headers_user_b
    )

    # User A lists devices -> should only see BIKE-USER-A
    res_a = client.get("/api/v1/devices", headers=auth_headers_user_a)
    assert res_a.status_code == 200
    devices_a = res_a.json()
    device_ids_a = [d["device_id"] for d in devices_a]
    assert "BIKE-USER-A" in device_ids_a
    assert "BIKE-USER-B" not in device_ids_a

    # User B lists devices -> should only see BIKE-USER-B
    res_b = client.get("/api/v1/devices", headers=auth_headers_user_b)
    assert res_b.status_code == 200
    devices_b = res_b.json()
    device_ids_b = [d["device_id"] for d in devices_b]
    assert "BIKE-USER-B" in device_ids_b
    assert "BIKE-USER-A" not in device_ids_b

    # User A can get own device
    get_a = client.get("/api/v1/devices/BIKE-USER-A", headers=auth_headers_user_a)
    assert get_a.status_code == 200
    assert get_a.json()["device_id"] == "BIKE-USER-A"

    # User B CANNOT get User A's device
    get_b_cross = client.get("/api/v1/devices/BIKE-USER-A", headers=auth_headers_user_b)
    assert get_b_cross.status_code == 403
    assert "access denied" in get_b_cross.json()["detail"].lower()

    # User A CANNOT get User B's device
    get_a_cross = client.get("/api/v1/devices/BIKE-USER-B", headers=auth_headers_user_a)
    assert get_a_cross.status_code == 403
    assert "access denied" in get_a_cross.json()["detail"].lower()
