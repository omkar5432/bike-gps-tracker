import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from uuid import uuid4
from backend.app.models.device import Device
from backend.app.models.alert import Alert

def test_create_alert_success(db_session):
    user_id = uuid4()
    device = Device(device_id="DEV-ALERT-1", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    now = datetime.now(timezone.utc)
    alert = Alert(
        device_id=device.id,
        type="GEOFENCE_EXIT",
        message="Bike left Home Safe Zone",
        latitude=37.7750,
        longitude=-122.4190
    )
    db_session.add(alert)
    db_session.commit()

    saved = db_session.query(Alert).filter_by(device_id=device.id).first()
    assert saved is not None
    assert saved.type == "GEOFENCE_EXIT"
    assert saved.message == "Bike left Home Safe Zone"
    assert saved.acknowledged is False

def test_alert_invalid_type_constraint(db_session):
    user_id = uuid4()
    device = Device(device_id="DEV-ALERT-2", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    alert = Alert(
        device_id=device.id,
        type="INVALID_TYPE_FOOBAR",
        message="Some message"
    )
    db_session.add(alert)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
