import time
import threading
from dataclasses import dataclass
from typing import Optional, Dict
from fastapi import Header, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database.connection import SessionLocal
from ..models.device import Device, DeviceStatus
from .config import settings
from .security import verify_device_secret

@dataclass
class DeviceAuthCacheEntry:
    """
    In-memory representation of authenticated device metadata.
    Stores device_id, database ID, current secret hash, user ID, status, and expiry.
    NEVER stores plaintext secrets or secret-derived keys.
    """
    device_id: str
    device_db_id: int
    device_secret_hash: str
    user_id: str
    status: DeviceStatus
    expires_at: float

# Global in-memory thread-safe cache: device_id -> DeviceAuthCacheEntry
_device_auth_cache: Dict[str, DeviceAuthCacheEntry] = {}
_cache_lock = threading.Lock()

def get_cached_device_auth(device_id: str) -> Optional[DeviceAuthCacheEntry]:
    """Retrieve cached device authentication entry in a thread-safe manner."""
    with _cache_lock:
        return _device_auth_cache.get(device_id)

def set_cached_device_auth(device_id: str, entry: DeviceAuthCacheEntry) -> None:
    """Set cached device authentication entry in a thread-safe manner."""
    with _cache_lock:
        _device_auth_cache[device_id] = entry

def invalidate_device_auth_cache(device_id: str) -> None:
    """Evict device authentication entry from the cache."""
    with _cache_lock:
        _device_auth_cache.pop(device_id, None)

def clear_device_auth_cache() -> None:
    """Clear all entries from the device authentication cache."""
    with _cache_lock:
        _device_auth_cache.clear()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def authenticate_device(
    x_device_id: Optional[str] = Header(None, alias="X-Device-ID"),
    x_device_secret: Optional[str] = Header(None, alias="X-Device-Secret"),
    db: Session = Depends(get_db)
) -> Device:
    """
    Reusable authentication dependency for IoT GPS devices.
    Validates X-Device-ID and X-Device-Secret using secure in-memory caching keyed by device_id.
    Rejects inactive devices with 403 Forbidden.
    Performs direct bcrypt verification on cache misses, expired TTL, or secret hash updates.
    Never stores or logs plaintext device secrets or derived secret representations.
    """
    if not x_device_id or not x_device_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing device credentials"
        )

    # 1. Look up the device by device_id in DB
    device = db.query(Device).filter(Device.device_id == x_device_id).first()

    # Generic authentication error if device not found or no secret hash configured
    if not device or not device.device_secret_hash:
        invalidate_device_auth_cache(x_device_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device credentials"
        )

    # 2. Check if device is deactivated (INACTIVE -> 403 Forbidden)
    if device.status == DeviceStatus.INACTIVE:
        invalidate_device_auth_cache(x_device_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device is deactivated and cannot transmit telemetry"
        )

    # 3. Check in-memory device authentication cache
    cached = get_cached_device_auth(x_device_id)
    now = time.time()

    is_cache_valid = (
        cached is not None
        and cached.device_secret_hash == device.device_secret_hash
        and now < cached.expires_at
    )

    if not is_cache_valid:
        # Cache miss, TTL expired, or device_secret_hash updated:
        # Perform fresh direct bcrypt verification
        if not verify_device_secret(x_device_secret, device.device_secret_hash):
            invalidate_device_auth_cache(x_device_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid device credentials"
            )

        # Verification succeeded -> populate cache entry
        ttl = getattr(settings, "DEVICE_AUTH_CACHE_TTL_SECONDS", 45)
        set_cached_device_auth(
            x_device_id,
            DeviceAuthCacheEntry(
                device_id=device.device_id,
                device_db_id=device.id,
                device_secret_hash=device.device_secret_hash,
                user_id=str(device.user_id),
                status=device.status,
                expires_at=now + ttl
            )
        )
    else:
        # Cache hit: verify incoming secret against cached hash
        if not verify_device_secret(x_device_secret, cached.device_secret_hash):
            invalidate_device_auth_cache(x_device_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid device credentials"
            )

    return device

