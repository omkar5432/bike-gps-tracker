from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models.device import Device
from ..models.alert import Alert

VALID_ALERT_TYPES = {
    "GEOFENCE_ENTER",
    "GEOFENCE_EXIT",
    "OVERSPEED",
    "DEVICE_OFFLINE",
    "UNEXPECTED_MOVEMENT",
}

DEFAULT_ALERT_LIMIT = 50
MAX_ALERT_LIMIT = 100

class AlertService:
    @staticmethod
    def create_alert(
        db: Session,
        device: Device,
        alert_type: str,
        message: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Alert:
        """Create and persist a new Alert record for a device."""
        if alert_type not in VALID_ALERT_TYPES:
            raise ValueError(f"Invalid alert type: {alert_type}. Must be one of {sorted(VALID_ALERT_TYPES)}")

        try:
            alert = Alert(
                device_id=device.id,
                type=alert_type,
                message=message,
                latitude=latitude,
                longitude=longitude,
                acknowledged=False
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            return alert
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def get_alerts_for_device(
        db: Session,
        device: Device,
        limit: int = DEFAULT_ALERT_LIMIT,
        unacknowledged_only: bool = False
    ) -> List[Alert]:
        """Retrieve alerts for a device, newest first, with pagination limit."""
        capped_limit = max(1, min(limit, MAX_ALERT_LIMIT))
        query = db.query(Alert).filter(Alert.device_id == device.id)
        
        if unacknowledged_only:
            query = query.filter(Alert.acknowledged == False)  # noqa: E712
            
        return (
            query
            .order_by(Alert.created_at.desc(), Alert.id.desc())
            .limit(capped_limit)
            .all()
        )

    @staticmethod
    def acknowledge_alert(db: Session, device: Device, alert_id: int) -> Alert:
        """Acknowledge an alert belonging to the given device."""
        alert = (
            db.query(Alert)
            .filter(Alert.id == alert_id, Alert.device_id == device.id)
            .first()
        )
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert with ID {alert_id} not found for this device."
            )
        
        try:
            alert.acknowledged = True
            alert.acknowledged_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(alert)
            return alert
        except Exception:
            db.rollback()
            raise
