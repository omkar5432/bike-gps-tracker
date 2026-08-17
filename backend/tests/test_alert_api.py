import pytest
from datetime import datetime, timezone
from backend.app.models.device import Device
from backend.app.models.alert import Alert

def test_list_alerts_api(client, auth_headers_user_a, db_session, test_user_a_uuid):
    device = Device(device_id="BIKE-ALERT-API-1", name="Alert Bike", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()

    # Create alerts directly
    alert1 = Alert(
        device_id=device.id,
        type="GEOFENCE_ENTER",
        message="Entered Safe Zone",
        latitude=18.520430,
        longitude=73.856744,
        acknowledged=False
    )
    alert2 = Alert(
        device_id=device.id,
        type="OVERSPEED",
        message="Speeding at 95 km/h",
        latitude=18.521000,
        longitude=73.857000,
        acknowledged=True,
        acknowledged_at=datetime.now(timezone.utc)
    )
    db_session.add_all([alert1, alert2])
    db_session.commit()

    # Get all alerts
    res = client.get("/api/v1/alerts/BIKE-ALERT-API-1", headers=auth_headers_user_a)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["device_id"] == "BIKE-ALERT-API-1"

    # Filter unacknowledged only
    res_unacked = client.get("/api/v1/alerts/BIKE-ALERT-API-1?unacknowledged_only=true", headers=auth_headers_user_a)
    assert res_unacked.status_code == 200
    unacked_data = res_unacked.json()
    assert len(unacked_data) == 1
    assert unacked_data[0]["type"] == "GEOFENCE_ENTER"

def test_acknowledge_alert_api(client, auth_headers_user_a, db_session, test_user_a_uuid):
    device = Device(device_id="BIKE-ALERT-API-2", name="Alert Bike 2", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()

    alert = Alert(
        device_id=device.id,
        type="GEOFENCE_EXIT",
        message="Exited Safe Zone",
        latitude=18.530000,
        longitude=73.860000,
        acknowledged=False
    )
    db_session.add(alert)
    db_session.commit()

    # Acknowledge
    ack_res = client.patch(f"/api/v1/alerts/BIKE-ALERT-API-2/{alert.id}/acknowledge", headers=auth_headers_user_a)
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["acknowledged"] is True
    assert ack_data["acknowledged_at"] is not None

def test_alert_cross_user_isolation(client, auth_headers_user_a, auth_headers_user_b, db_session, test_user_a_uuid):
    device = Device(device_id="BIKE-ALERT-USER-A", name="User A Bike", user_id=test_user_a_uuid)
    db_session.add(device)
    db_session.commit()

    alert = Alert(
        device_id=device.id,
        type="GEOFENCE_ENTER",
        message="User A Alert",
        acknowledged=False
    )
    db_session.add(alert)
    db_session.commit()

    # User B cannot list User A's alerts
    res_list = client.get("/api/v1/alerts/BIKE-ALERT-USER-A", headers=auth_headers_user_b)
    assert res_list.status_code == 403

    # User B cannot acknowledge User A's alerts
    res_ack = client.patch(f"/api/v1/alerts/BIKE-ALERT-USER-A/{alert.id}/acknowledge", headers=auth_headers_user_b)
    assert res_ack.status_code == 403
