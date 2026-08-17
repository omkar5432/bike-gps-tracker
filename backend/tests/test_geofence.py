import pytest
from sqlalchemy.exc import IntegrityError
from uuid import uuid4
from backend.app.models.device import Device
from backend.app.models.geofence import Geofence

def test_create_geofence_success(db_session):
    user_id = uuid4()
    device = Device(device_id="DEV-GEO-1", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    geo = Geofence(
        device_id=device.id,
        name="Home Safe Zone",
        latitude=37.7749,
        longitude=-122.4194,
        radius=150.0,
        enabled=True
    )
    db_session.add(geo)
    db_session.commit()

    saved = db_session.query(Geofence).filter_by(device_id=device.id).first()
    assert saved is not None
    assert saved.name == "Home Safe Zone"
    assert saved.radius == 150.0
    assert saved.enabled is True

def test_geofence_invalid_radius_constraint(db_session):
    from uuid import uuid4
    user_id = uuid4()
    device = Device(device_id="DEV-GEO-2", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    geo = Geofence(
        device_id=device.id,
        name="Invalid Zone",
        latitude=37.7749,
        longitude=-122.4194,
        radius=0.0  # Invalid (must be > 0)
    )
    db_session.add(geo)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
