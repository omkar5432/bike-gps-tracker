from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ...core.auth import get_current_user_id, get_db
from ...models.trip import Trip
from ...schemas.trip import TripResponse, TripSummaryResponse
from ...schemas.location import LocationResponse
from ...services.device_service import DeviceService
from ...services.trip_service import (
    TripService,
    format_duration,
    DEFAULT_TRIP_LIMIT,
    MAX_TRIP_LIMIT,
)

router = APIRouter(prefix="/trips", tags=["Trips"])


def trip_to_response(trip: Trip, hardware_device_id: str) -> TripResponse:
    return TripResponse(
        id=trip.id,
        device_id=hardware_device_id,
        start_time=trip.start_time,
        end_time=trip.end_time,
        distance=float(trip.distance) if trip.distance is not None else 0.0,
        duration=format_duration(trip.duration),
        max_speed=float(trip.max_speed) if trip.max_speed is not None else 0.0,
        average_speed=float(trip.average_speed) if trip.average_speed is not None else 0.0,
        created_at=trip.created_at,
        status="ACTIVE" if trip.end_time is None else "COMPLETED"
    )


@router.get(
    "/{device_id}",
    response_model=List[TripResponse],
    summary="Get recent trips for a device"
)
async def get_device_trips(
    device_id: str,
    limit: int = Query(DEFAULT_TRIP_LIMIT, ge=1, le=MAX_TRIP_LIMIT),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Return recent trips for a device owned by the authenticated user, ordered newest first.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    trips = TripService.get_device_trips(db, device, limit)
    return [trip_to_response(t, device.device_id) for t in trips]


@router.get(
    "/{device_id}/summary",
    response_model=TripSummaryResponse,
    summary="Get aggregated trip analytics and summary for a device"
)
async def get_device_trip_summary(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Return aggregated statistics: total trips, total distance, max speed, average distance.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    summary = TripService.get_device_trip_summary(db, device)
    return TripSummaryResponse(**summary)


@router.get(
    "/{device_id}/{trip_id}",
    response_model=TripResponse,
    summary="Get a specific trip by ID"
)
async def get_trip(
    device_id: str,
    trip_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve single trip details ensuring it belongs to the user's device.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    trip = TripService.get_trip_by_id(db, device, trip_id)
    return trip_to_response(trip, device.device_id)


@router.get(
    "/{device_id}/{trip_id}/route",
    response_model=List[LocationResponse],
    summary="Get chronological route locations for a specific trip"
)
async def get_trip_route(
    device_id: str,
    trip_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve all GPS location telemetry recorded during this trip in chronological order.
    """
    device = DeviceService.get_user_device_by_id(db, device_id, user_id)
    locations = TripService.get_trip_route_locations(db, device, trip_id)
    return [
        LocationResponse(
            id=loc.id,
            device_id=device.device_id,
            latitude=float(loc.latitude),
            longitude=float(loc.longitude),
            speed=float(loc.speed) if loc.speed is not None else None,
            altitude=float(loc.altitude) if loc.altitude is not None else None,
            battery=float(loc.battery) if loc.battery is not None else None,
            gps_accuracy=float(loc.gps_accuracy) if loc.gps_accuracy is not None else None,
            satellites=loc.satellites,
            timestamp=loc.timestamp,
            created_at=loc.created_at
        )
        for loc in locations
    ]

