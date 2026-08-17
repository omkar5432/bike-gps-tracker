from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from ...core.auth import get_current_user_id, get_db as get_user_db
from ...models.geofence import Geofence
from ...schemas.geofence import GeofenceCreate, GeofenceUpdate, GeofenceResponse
from ...services.device_service import DeviceService
from ...services.geofence_service import GeofenceService

router = APIRouter(prefix="/geofences", tags=["Geofences"])

def geofence_to_response(geo: Geofence, hardware_device_id: str) -> GeofenceResponse:
    return GeofenceResponse(
        id=geo.id,
        device_id=hardware_device_id,
        name=geo.name,
        latitude=float(geo.latitude),
        longitude=float(geo.longitude),
        radius=float(geo.radius),
        enabled=geo.enabled,
        created_at=geo.created_at,
        updated_at=geo.updated_at
    )

@router.post(
    "/{device_id}",
    response_model=GeofenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a geofence for a device"
)
async def create_geofence(
    device_id: str,
    geofence_in: GeofenceCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Create a new geofence circular safe zone for a device owned by the authenticated user.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    geofence = GeofenceService.create_geofence(db, device, geofence_in)
    return geofence_to_response(geofence, device.device_id)

@router.get(
    "/{device_id}",
    response_model=List[GeofenceResponse],
    summary="List all geofences for a device"
)
async def list_geofences(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Retrieve all geofences configured for a device owned by the authenticated user.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    geofences = GeofenceService.get_geofences_for_device(db, device)
    return [geofence_to_response(g, device.device_id) for g in geofences]

@router.get(
    "/{device_id}/{geofence_id}",
    response_model=GeofenceResponse,
    summary="Get a specific geofence"
)
async def get_geofence(
    device_id: str,
    geofence_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Retrieve a specific geofence by ID for an owned device.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    geofence = GeofenceService.get_geofence_by_id(db, device, geofence_id)
    return geofence_to_response(geofence, device.device_id)

@router.put(
    "/{device_id}/{geofence_id}",
    response_model=GeofenceResponse,
    summary="Update a geofence"
)
async def update_geofence(
    device_id: str,
    geofence_id: int,
    geofence_in: GeofenceUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Update the name, center coordinates, radius, or status of a geofence.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    geofence = GeofenceService.update_geofence(db, device, geofence_id, geofence_in)
    return geofence_to_response(geofence, device.device_id)

@router.delete(
    "/{device_id}/{geofence_id}",
    summary="Delete a geofence"
)
async def delete_geofence(
    device_id: str,
    geofence_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Permanently delete a geofence from an owned device.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    GeofenceService.delete_geofence(db, device, geofence_id)
    return {"status": "success", "message": f"Geofence {geofence_id} deleted successfully."}

@router.patch(
    "/{device_id}/{geofence_id}/enable",
    response_model=GeofenceResponse,
    summary="Enable a geofence"
)
async def enable_geofence(
    device_id: str,
    geofence_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Enable monitoring for an existing geofence.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    geofence = GeofenceService.set_geofence_status(db, device, geofence_id, True)
    return geofence_to_response(geofence, device.device_id)

@router.patch(
    "/{device_id}/{geofence_id}/disable",
    response_model=GeofenceResponse,
    summary="Disable a geofence"
)
async def disable_geofence(
    device_id: str,
    geofence_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Disable monitoring for an existing geofence without deleting it.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    geofence = GeofenceService.set_geofence_status(db, device, geofence_id, False)
    return geofence_to_response(geofence, device.device_id)
