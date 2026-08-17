from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from ...core.auth import get_current_user_id, get_db
from ...core.device_auth import authenticate_device, invalidate_device_auth_cache
from ...models.device import Device, DeviceStatus
from ...schemas.device import DeviceCreate, DeviceResponse, DeviceRegistrationResponse
from ...services.device_service import DeviceService

router = APIRouter(prefix="/devices", tags=["Devices"])

@router.post(
    "",
    response_model=DeviceRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new GPS device"
)
async def register_device(
    device_in: DeviceCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Register a new GPS tracking device for the authenticated user.
    Returns the raw device secret ONLY ONCE. Store it securely!
    """
    device = DeviceService.register_device(db, device_in, user_id)
    return device

@router.get(
    "",
    response_model=List[DeviceResponse],
    summary="List all devices owned by the authenticated user"
)
async def list_devices(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Retrieve all devices belonging to the authenticated user."""
    return DeviceService.get_user_devices(db, user_id)

@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Get details of a specific device"
)
async def get_device(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Retrieve a specific device owned by the authenticated user."""
    return DeviceService.get_user_device_by_id(db, device_id, user_id)

@router.post(
    "/{device_id}/deactivate",
    response_model=DeviceResponse,
    summary="Safely deactivate a device"
)
async def deactivate_device(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Safely deactivate a device setting its status to INACTIVE and invalidating cache."""
    device = DeviceService.deactivate_device(db, device_id, user_id)
    invalidate_device_auth_cache(device_id)
    return device
@router.delete(
    "/{device_id}",
    status_code=status.HTTP_200_OK,
    summary="Permanently delete a device"
)
async def delete_device(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Permanently delete a device and its history owned by the authenticated user."""
    DeviceService.delete_device(db, device_id, user_id)
    invalidate_device_auth_cache(device_id)
    return {"status": "success", "message": f"Device '{device_id}' deleted successfully"}
@router.post(
    "/auth/verify",
    summary="Verify device credentials"
)
async def verify_device_credentials(
    device: Device = Depends(authenticate_device),
    db: Session = Depends(get_db)
):
    """
    Test endpoint for GPS tracker hardware authentication.
    Validates X-Device-ID and X-Device-Secret headers and updates last_seen.
    """
    device.last_seen = datetime.now(timezone.utc)
    device.status = DeviceStatus.ONLINE
    db.commit()
    return {
        "status": "authenticated",
        "device_id": device.device_id,
        "device_status": device.status,
        "last_seen": device.last_seen
    }
