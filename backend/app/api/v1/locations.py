import asyncio
import logging
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from ...core.auth import get_current_user_id
from ...core.device_auth import authenticate_device, get_db as get_device_db
from ...core.auth import get_db as get_user_db
from ...models.alert import Alert
from ...models.device import Device
from ...models.location import Location
from ...schemas.location import LocationCreate, LocationResponse
from ...services.device_service import DeviceService
from ...services.location_service import (
    LocationService,
    DEFAULT_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT,
)
from ...websocket.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/locations", tags=["Locations"])

def create_location_message(location: Location, device_id: str) -> dict:
    """Create a WebSocket message for location broadcast."""
    return {
        "event": "location_update",
        "data": {
            "id": location.id,
            "device_id": device_id,
            "latitude": float(location.latitude) if location.latitude is not None else None,
            "longitude": float(location.longitude) if location.longitude is not None else None,
            "speed": float(location.speed) if location.speed is not None else None,
            "altitude": float(location.altitude) if location.altitude is not None else None,
            "battery": float(location.battery) if location.battery is not None else None,
            "gps_accuracy": float(location.gps_accuracy) if location.gps_accuracy is not None else None,
            "satellites": location.satellites,
            "timestamp": location.timestamp.isoformat() if location.timestamp else None
        }
    }

def create_alert_message(alert: Alert, device_id: str) -> dict:
    """Create a WebSocket message for alert broadcast."""
    return {
        "event": "alert",
        "data": {
            "id": alert.id,
            "device_id": device_id,
            "type": alert.type,
            "message": alert.message,
            "latitude": float(alert.latitude) if alert.latitude is not None else None,
            "longitude": float(alert.longitude) if alert.longitude is not None else None,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
            "acknowledged": alert.acknowledged
        }
    }

from ...models.trip import Trip

def create_trip_message(trip: Trip, device_id: str, event_name: str) -> dict:
    """Create a WebSocket message for trip lifecycle events."""
    return {
        "event": event_name,
        "data": {
            "id": trip.id,
            "device_id": device_id,
            "start_time": trip.start_time.isoformat() if trip.start_time else None,
            "end_time": trip.end_time.isoformat() if trip.end_time else None,
            "distance": float(trip.distance) if trip.distance is not None else 0.0,
            "duration": str(trip.duration) if trip.duration else None,
            "max_speed": float(trip.max_speed) if trip.max_speed is not None else 0.0,
            "average_speed": float(trip.average_speed) if trip.average_speed is not None else 0.0,
            "status": "ACTIVE" if trip.end_time is None else "COMPLETED"
        }
    }

def location_to_response(location: Location, hardware_device_id: str) -> LocationResponse:
    return LocationResponse(
        id=location.id,
        device_id=hardware_device_id,
        latitude=location.latitude,
        longitude=location.longitude,
        speed=location.speed,
        altitude=location.altitude,
        battery=location.battery,
        gps_accuracy=location.gps_accuracy,
        satellites=location.satellites,
        timestamp=location.timestamp,
        created_at=location.created_at
    )

from starlette.concurrency import run_in_threadpool

@router.post(
    "",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest GPS location telemetry"
)
async def ingest_location(
    location_in: LocationCreate,
    device: Device = Depends(authenticate_device),
    db: Session = Depends(get_device_db)
):
    """
    Ingest a GPS telemetry point from an authenticated hardware device or simulator.
    Authenticates via X-Device-ID and X-Device-Secret headers with in-memory caching.
    Persists PostGIS geometry, evaluates geofence transitions, overspeed conditions,
    and automatic trip lifecycles within a single atomic database transaction.
    Broadcasts location, alerts, and trip events to connected WebSocket clients.
    """
    # Offload synchronous database transaction from the asyncio event loop
    location, alerts, trip_event = await run_in_threadpool(
        LocationService.ingest_location, db, device, location_in
    )
    
    # Broadcast location update to WebSocket clients after successful commit
    try:
        message = create_location_message(location, device.device_id)
        await manager.broadcast_to_device(device.device_id, message)
    except Exception as e:
        logger.error(f"Failed to broadcast WebSocket location for device {device.device_id}: {e}")

    # Broadcast any triggered alerts to WebSocket clients
    for alert in alerts:
        try:
            alert_msg = create_alert_message(alert, device.device_id)
            await manager.broadcast_to_device(device.device_id, alert_msg)
        except Exception as e:
            logger.error(f"Failed to broadcast WebSocket alert for device {device.device_id}: {e}")
    
    # Broadcast trip lifecycle event if trip started or completed
    if trip_event and trip_event.get("event") in ("trip_started", "trip_completed") and "trip" in trip_event:
        try:
            trip_msg = create_trip_message(trip_event["trip"], device.device_id, trip_event["event"])
            await manager.broadcast_to_device(device.device_id, trip_msg)
        except Exception as e:
            logger.error(f"Failed to broadcast WebSocket trip event for device {device.device_id}: {e}")

    return location_to_response(location, device.device_id)


@router.get(
    "/{device_id}/history",
    response_model=List[LocationResponse],
    summary="Get recent location history for a device"
)
async def get_location_history(
    device_id: str,
    limit: int = Query(DEFAULT_HISTORY_LIMIT, ge=1, le=MAX_HISTORY_LIMIT),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_user_db)
):
    """
    Return recent GPS locations for a device owned by the authenticated user.
    Ordered by timestamp descending (newest first).
    """
    def _fetch_history():
        dev = DeviceService.get_user_device_by_id(db, device_id, user_id)
        locs = LocationService.get_location_history(db, dev, limit)
        return dev.device_id, locs

    dev_id, locations = await run_in_threadpool(_fetch_history)
    return [location_to_response(loc, dev_id) for loc in locations]
