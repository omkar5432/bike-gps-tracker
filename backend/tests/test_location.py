import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from backend.app.models.device import Device
from backend.app.models.location import Location

def test_create_location_success(db_session):
    from uuid import uuid4
    user_id = uuid4()
    device = Device(device_id="DEV-LOC-1", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    now = datetime.now(timezone.utc)
    loc = Location(
        device_id=device.id,
        latitude=37.7749,
        longitude=-122.4194,
        speed=15.5,
        altitude=30.0,
        battery=88.5,
        gps_accuracy=2.5,
        satellites=8,
        timestamp=now,
    )
    db_session.add(loc)
    db_session.commit()

    saved = db_session.query(Location).filter_by(device_id=device.id).first()
    assert saved is not None
    assert saved.latitude == 37.7749
    assert saved.longitude == -122.4194
    assert saved.speed == 15.5
    assert saved.battery == 88.5
    assert saved.satellites == 8

def test_location_latitude_bounds_constraint(db_session):
    from uuid import uuid4
    user_id = uuid4()
    device = Device(device_id="DEV-LOC-2", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    loc = Location(
        device_id=device.id,
        latitude=95.0,  # Invalid (>90)
        longitude=-122.4194,
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(loc)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_location_speed_non_negative_constraint(db_session):
    from uuid import uuid4
    user_id = uuid4()
    device = Device(device_id="DEV-LOC-3", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    loc = Location(
        device_id=device.id,
        latitude=37.7749,
        longitude=-122.4194,
        speed=-5.0,  # Invalid (<0)
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(loc)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
