import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone
from fastapi import HTTPException
from backend.app.models.device import Device
from backend.app.models.alert import Alert
from backend.app.services.alert_service import AlertService, VALID_ALERT_TYPES
from backend.app.schemas.alert import AlertResponse, AlertAcknowledgeResponse

def test_alert_service_create_alert():
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-ALERT", user_id="00000000-0000-0000-0000-000000000001")

    alert = AlertService.create_alert(
        db=mock_db,
        device=mock_device,
        alert_type="GEOFENCE_ENTER",
        message="Bike entered geofence: Safe Zone",
        latitude=18.520430,
        longitude=73.856744
    )

    assert alert.device_id == 1
    assert alert.type == "GEOFENCE_ENTER"
    assert alert.message == "Bike entered geofence: Safe Zone"
    assert alert.latitude == 18.520430
    assert alert.longitude == 73.856744
    assert alert.acknowledged is False
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()

def test_alert_service_invalid_type_rejected():
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-ALERT", user_id="00000000-0000-0000-0000-000000000001")

    with pytest.raises(ValueError) as exc:
        AlertService.create_alert(
            db=mock_db,
            device=mock_device,
            alert_type="UNKNOWN_INVALID_TYPE",
            message="Test"
        )
    assert "Invalid alert type" in str(exc.value)

def test_alert_service_acknowledge_alert():
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-ALERT", user_id="00000000-0000-0000-0000-000000000001")

    mock_alert = Alert(
        id=55,
        device_id=1,
        type="OVERSPEED",
        message="Speeding",
        acknowledged=False
    )
    mock_db.query.return_value.filter.return_value.first.return_value = mock_alert

    acked = AlertService.acknowledge_alert(mock_db, mock_device, 55)

    assert acked.acknowledged is True
    assert acked.acknowledged_at is not None
    mock_db.commit.assert_called_once()

def test_alert_service_acknowledge_nonexistent_raises_404():
    mock_db = MagicMock()
    mock_device = Device(id=1, device_id="TEST-DEV-ALERT", user_id="00000000-0000-0000-0000-000000000001")

    mock_db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc:
        AlertService.acknowledge_alert(mock_db, mock_device, 999)
    assert exc.value.status_code == 404

def test_alert_response_schema():
    now = datetime.now(timezone.utc)
    res = AlertResponse(
        id=123,
        device_id="BIKE-P7-E2E",
        type="GEOFENCE_ENTER",
        message="Bike entered geofence: Home",
        latitude=18.520750,
        longitude=73.857145,
        created_at=now,
        acknowledged=False
    )
    assert res.id == 123
    assert res.device_id == "BIKE-P7-E2E"
    assert res.type == "GEOFENCE_ENTER"
    assert res.acknowledged is False
    assert res.acknowledged_at is None
