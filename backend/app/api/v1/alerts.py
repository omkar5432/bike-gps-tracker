from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from ...core.auth import get_current_user_id, get_db as get_user_db
from ...models.alert import Alert
from ...schemas.alert import AlertResponse
from ...services.device_service import DeviceService
from ...services.alert_service import AlertService, DEFAULT_ALERT_LIMIT, MAX_ALERT_LIMIT

router = APIRouter(prefix="/alerts", tags=["Alerts"])

def alert_to_response(alert: Alert, hardware_device_id: str) -> AlertResponse:
    return AlertResponse(
        id=alert.id,
        device_id=hardware_device_id,
        type=alert.type,
        message=alert.message,
        latitude=float(alert.latitude) if alert.latitude is not None else None,
        longitude=float(alert.longitude) if alert.longitude is not None else None,
        created_at=alert.created_at,
        acknowledged=alert.acknowledged,
        acknowledged_at=alert.acknowledged_at
    )

@router.get(
    "/{device_id}",
    response_model=List[AlertResponse],
    summary="Get alerts for a device"
)
async def get_alerts(
    device_id: str,
    limit: int = Query(DEFAULT_ALERT_LIMIT, ge=1, le=MAX_ALERT_LIMIT, description="Max alerts to retrieve"),
    unacknowledged_only: bool = Query(False, description="Filter for only unacknowledged alerts"),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Retrieve recent alerts (geofence breaches, overspeed, etc.) for a device owned by the user,
    ordered newest first.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    alerts = AlertService.get_alerts_for_device(
        db,
        device,
        limit=limit,
        unacknowledged_only=unacknowledged_only
    )
    return [alert_to_response(a, device.device_id) for a in alerts]

@router.patch(
    "/{device_id}/{alert_id}/acknowledge",
    response_model=AlertResponse,
    summary="Acknowledge an alert"
)
async def acknowledge_alert(
    device_id: str,
    alert_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Mark an active alert as acknowledged by the device owner.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    alert = AlertService.acknowledge_alert(db, device, alert_id)
    return alert_to_response(alert, device.device_id)
