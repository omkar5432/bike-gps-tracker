import pytest
from datetime import datetime, timezone
from backend.app.models.alert import Alert
from backend.app.api.v1.locations import create_alert_message

def test_create_alert_websocket_message():
    now = datetime(2026, 8, 15, 17, 0, 0, tzinfo=timezone.utc)
    alert = Alert(
        id=123,
        device_id=1,
        type="GEOFENCE_ENTER",
        message="Bike entered geofence: Home",
        latitude=18.520750,
        longitude=73.857145,
        created_at=now,
        acknowledged=False
    )

    msg = create_alert_message(alert, "BIKE-P7-E2E")

    assert msg["event"] == "alert"
    data = msg["data"]
    assert data["id"] == 123
    assert data["device_id"] == "BIKE-P7-E2E"
    assert data["type"] == "GEOFENCE_ENTER"
    assert data["message"] == "Bike entered geofence: Home"
    assert data["latitude"] == 18.520750
    assert data["longitude"] == 73.857145
    assert data["acknowledged"] is False
    assert "2026-08-15" in data["created_at"]
