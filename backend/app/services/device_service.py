import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models.device import Device, DeviceStatus
from ..schemas.device import DeviceCreate
from ..core.security import generate_device_secret, hash_device_secret

# Configurable device communication thresholds in seconds
DEVICE_ONLINE_THRESHOLD_SECONDS = int(os.getenv("DEVICE_ONLINE_THRESHOLD_SECONDS", "35"))
DEVICE_RECENT_THRESHOLD_SECONDS = int(os.getenv("DEVICE_RECENT_THRESHOLD_SECONDS", "120"))
DEVICE_DELAYED_THRESHOLD_SECONDS = int(os.getenv("DEVICE_DELAYED_THRESHOLD_SECONDS", "600"))

class DeviceService:
    @staticmethod
    def compute_device_status(last_seen: Optional[datetime], current_status: str = DeviceStatus.OFFLINE) -> str:
        """
        Authoritative real-time device status calculation.
        Derives status dynamically from the actual timestamp of the last communication.
        
        Thresholds:
          - <= 35s: ONLINE
          - <= 120s: RECENTLY_SEEN
          - <= 600s (10m): DELAYED
          - > 600s or null: OFFLINE
          - INACTIVE overrides all if manually deactivated
        """
        if current_status == DeviceStatus.INACTIVE:
            return DeviceStatus.INACTIVE

        if not last_seen:
            return DeviceStatus.OFFLINE

        now = datetime.now(timezone.utc)

        # Ensure last_seen is timezone-aware in UTC
        if last_seen.tzinfo is None:
            last_seen_utc = last_seen.replace(tzinfo=timezone.utc)
        else:
            last_seen_utc = last_seen.astimezone(timezone.utc)

        diff_seconds = (now - last_seen_utc).total_seconds()

        # Handle clock skew / small negative diffs
        if diff_seconds < 0:
            diff_seconds = 0

        if diff_seconds <= DEVICE_ONLINE_THRESHOLD_SECONDS:
            return DeviceStatus.ONLINE
        elif diff_seconds <= DEVICE_RECENT_THRESHOLD_SECONDS:
            return DeviceStatus.RECENTLY_SEEN
        elif diff_seconds <= DEVICE_DELAYED_THRESHOLD_SECONDS:
            return DeviceStatus.DELAYED
        else:
            return DeviceStatus.OFFLINE

    @staticmethod
    def register_device(db: Session, device_in: DeviceCreate, user_id: str) -> Device:
        """
        Register a new GPS tracking device for the authenticated user.
        Generates a cryptographically secure device secret, stores its hash,
        and returns the raw secret to the client (only once).
        """
        # Check duplicate device_id
        existing_device = db.query(Device).filter(Device.device_id == device_in.device_id).first()
        if existing_device:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Device with ID '{device_in.device_id}' is already registered."
            )

        # Check duplicate IMEI if provided
        if device_in.imei:
            existing_imei = db.query(Device).filter(Device.imei == device_in.imei).first()
            if existing_imei:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Device with IMEI '{device_in.imei}' is already registered."
                )

        # Generate device secret and hash
        raw_secret = generate_device_secret()
        secret_hash = hash_device_secret(raw_secret)

        device = Device(
            device_id=device_in.device_id,
            name=device_in.name,
            imei=device_in.imei,
            status=DeviceStatus.OFFLINE,
            user_id=user_id,
            device_secret_hash=secret_hash
        )

        db.add(device)
        db.commit()
        db.refresh(device)

        # Store raw secret on the device object for return to client
        device.device_secret = raw_secret
        return device

    @staticmethod
    def get_user_devices(db: Session, user_id: str) -> List[Device]:
        """
        Retrieve all devices owned by the authenticated user with dynamically computed real-time status.
        """
        devices = db.query(Device).filter(Device.user_id == user_id).all()
        for dev in devices:
            dev.status = DeviceService.compute_device_status(dev.last_seen, dev.status)
        return devices

    @staticmethod
    def get_user_device_by_id(db: Session, device_id: str, user_id: str) -> Device:
        """
        Retrieve a single device by device_id enforcing user ownership with dynamically computed status.
        """
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device '{device_id}' not found."
            )

        if str(device.user_id) != str(user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this device."
            )

        device.status = DeviceService.compute_device_status(device.last_seen, device.status)
        return device

    @staticmethod
    def deactivate_device(db: Session, device_id: str, user_id: str) -> Device:
        """Safely deactivate a device without destroying records."""
        device = DeviceService.get_user_device_by_id(db, device_id, user_id)
        device.status = DeviceStatus.INACTIVE
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def delete_device(db: Session, device_id: str, user_id: str) -> None:
        """Permanently delete a device and cascade-delete its locations, trips, geofences, and alerts."""
        device = DeviceService.get_user_device_by_id(db, device_id, user_id)
        db.delete(device)
        db.commit()
