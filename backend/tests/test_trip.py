import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from uuid import uuid4
from backend.app.models.device import Device
from backend.app.models.trip import Trip

def test_create_trip_success(db_session):
    user_id = uuid4()
    device = Device(device_id="DEV-TRIP-1", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    start = datetime.now(timezone.utc)
    trip = Trip(
        device_id=device.id,
        start_time=start,
        distance=12.4,
        max_speed=32.1,
        average_speed=18.5,
        duration="00:40:00"
    )
    db_session.add(trip)
    db_session.commit()

    saved = db_session.query(Trip).filter_by(device_id=device.id).first()
    assert saved is not None
    assert saved.distance == 12.4
    assert saved.max_speed == 32.1
    assert saved.average_speed == 18.5

def test_trip_negative_distance_constraint(db_session):
    from uuid import uuid4
    user_id = uuid4()
    device = Device(device_id="DEV-TRIP-2", user_id=user_id)
    db_session.add(device)
    db_session.commit()

    trip = Trip(
        device_id=device.id,
        start_time=datetime.now(timezone.utc),
        distance=-1.0  # Invalid
    )
    db_session.add(trip)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
