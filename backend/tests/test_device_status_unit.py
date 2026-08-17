from datetime import datetime, timezone, timedelta
from backend.app.models.device import DeviceStatus
from backend.app.services.device_service import DeviceService

def test_compute_device_status_none_timestamp():
    """Device with no communication timestamp should be OFFLINE."""
    status = DeviceService.compute_device_status(None)
    assert status == DeviceStatus.OFFLINE

def test_compute_device_status_live():
    """Device communication within 35 seconds is ONLINE/LIVE."""
    recent_time = datetime.now(timezone.utc) - timedelta(seconds=10)
    status = DeviceService.compute_device_status(recent_time)
    assert status == DeviceStatus.ONLINE

def test_compute_device_status_recently_seen():
    """Device communication between 35s and 120s is RECENTLY_SEEN."""
    recent_time = datetime.now(timezone.utc) - timedelta(seconds=60)
    status = DeviceService.compute_device_status(recent_time)
    assert status == DeviceStatus.RECENTLY_SEEN

def test_compute_device_status_delayed():
    """Device communication between 2m and 10m is DELAYED."""
    delayed_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    status = DeviceService.compute_device_status(delayed_time)
    assert status == DeviceStatus.DELAYED

def test_compute_device_status_offline():
    """Device communication older than 10m is OFFLINE."""
    old_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    status = DeviceService.compute_device_status(old_time)
    assert status == DeviceStatus.OFFLINE

def test_compute_device_status_inactive_override():
    """Manually deactivated device stays INACTIVE regardless of timestamp."""
    recent_time = datetime.now(timezone.utc)
    status = DeviceService.compute_device_status(recent_time, current_status=DeviceStatus.INACTIVE)
    assert status == DeviceStatus.INACTIVE

def test_compute_device_status_future_timestamp():
    """Slightly future timestamp due to clock skew is treated safely as ONLINE."""
    future_time = datetime.now(timezone.utc) + timedelta(seconds=5)
    status = DeviceService.compute_device_status(future_time)
    assert status == DeviceStatus.ONLINE
