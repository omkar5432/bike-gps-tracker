import pytest
from sqlalchemy.exc import IntegrityError
from backend.app.models.device import Device, DeviceStatus
from uuid import uuid4

def test_create_device_success(db_session):
    user_id = uuid4()
    device = Device(
        device_id="DEV-001",
        name="Bike Tracker",
        imei="860123456789012",
        status=DeviceStatus.ONLINE,
        user_id=user_id
    )
    db_session.add(device)
    db_session.commit()

    saved = db_session.query(Device).filter_by(device_id="DEV-001").first()
    assert saved is not None
    assert saved.name == "Bike Tracker"
    assert saved.status == DeviceStatus.ONLINE
    assert saved.user_id == user_id

def test_device_unique_device_id(db_session):
    user_id1 = uuid4()
    user_id2 = uuid4()
    dev1 = Device(device_id="DEV-DUP", name="Device 1", imei="111111111111111", user_id=user_id1)
    dev2 = Device(device_id="DEV-DUP", name="Device 2", imei="222222222222222", user_id=user_id2)
    db_session.add(dev1)
    db_session.commit()

    db_session.add(dev2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
