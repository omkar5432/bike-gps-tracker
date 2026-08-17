import pytest
from pydantic import ValidationError
from backend.app.schemas.geofence import GeofenceCreate, GeofenceUpdate, GeofenceResponse
from backend.app.schemas.alert import AlertResponse, AlertAcknowledgeResponse
from backend.app.services.alert_service import VALID_ALERT_TYPES

def test_geofence_create_schema_validation():
    # Valid
    valid = GeofenceCreate(
        name="Home Safe Zone",
        latitude=18.520430,
        longitude=73.856744,
        radius=500.0,
        enabled=True
    )
    assert valid.name == "Home Safe Zone"
    assert valid.latitude == 18.520430
    assert valid.radius == 500.0
    assert valid.enabled is True

    # Invalid latitude > 90
    with pytest.raises(ValidationError):
        GeofenceCreate(name="Bad Lat", latitude=95.0, longitude=73.85, radius=100.0)

    # Invalid latitude < -90
    with pytest.raises(ValidationError):
        GeofenceCreate(name="Bad Lat", latitude=-95.0, longitude=73.85, radius=100.0)

    # Invalid longitude > 180
    with pytest.raises(ValidationError):
        GeofenceCreate(name="Bad Lon", latitude=18.52, longitude=185.0, radius=100.0)

    # Invalid longitude < -180
    with pytest.raises(ValidationError):
        GeofenceCreate(name="Bad Lon", latitude=18.52, longitude=-185.0, radius=100.0)

    # Invalid radius <= 0
    with pytest.raises(ValidationError):
        GeofenceCreate(name="Zero Radius", latitude=18.52, longitude=73.85, radius=0.0)

    with pytest.raises(ValidationError):
        GeofenceCreate(name="Negative Radius", latitude=18.52, longitude=73.85, radius=-50.0)

    # Empty name
    with pytest.raises(ValidationError):
        GeofenceCreate(name="", latitude=18.52, longitude=73.85, radius=100.0)

def test_geofence_update_schema_validation():
    # Valid partial update
    update = GeofenceUpdate(radius=750.0, enabled=False)
    assert update.radius == 750.0
    assert update.enabled is False
    assert update.name is None
    assert update.latitude is None

    # Invalid radius in update
    with pytest.raises(ValidationError):
        GeofenceUpdate(radius=-10.0)

def test_valid_alert_types():
    assert "GEOFENCE_ENTER" in VALID_ALERT_TYPES
    assert "GEOFENCE_EXIT" in VALID_ALERT_TYPES
    assert "OVERSPEED" in VALID_ALERT_TYPES
    assert "DEVICE_OFFLINE" in VALID_ALERT_TYPES
    assert "UNEXPECTED_MOVEMENT" in VALID_ALERT_TYPES
