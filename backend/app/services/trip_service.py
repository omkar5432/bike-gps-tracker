from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.device import Device
from ..models.trip import Trip
from ..models.location import Location

DEFAULT_TRIP_LIMIT = 20
MAX_TRIP_LIMIT = 100

# Trip lifecycle default thresholds
DEFAULT_TRIP_START_SPEED_KMH = 5.0
DEFAULT_TRIP_IDLE_TIMEOUT_SECONDS = 300.0  # 5 minutes
DEFAULT_MAX_GPS_JUMP_SPEED_KMH = 150.0  # Filter unrealistic coordinate spikes


def format_duration(duration: Optional[timedelta]) -> Optional[str]:
    """Format an Interval/timedelta as HH:MM:SS for API responses."""
    if duration is None:
        return None
    total_seconds = int(duration.total_seconds())
    if total_seconds < 0:
        total_seconds = 0
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


class TripService:
    @staticmethod
    def get_active_trip(db: Session, device: Device) -> Optional[Trip]:
        """Retrieve the currently ongoing active trip for a device (end_time is NULL)."""
        return (
            db.query(Trip)
            .filter(Trip.device_id == device.id, Trip.end_time.is_(None))
            .order_by(Trip.start_time.desc())
            .first()
        )

    @staticmethod
    def start_trip(
        db: Session,
        device: Device,
        start_time: datetime,
        initial_speed: Optional[float] = None
    ) -> Trip:
        """Create and persist a new active trip record for a moving device."""
        speed_val = Decimal(str(round(initial_speed, 2))) if initial_speed is not None and initial_speed > 0 else Decimal("0.0")
        trip = Trip(
            device_id=device.id,
            start_time=start_time,
            end_time=None,
            distance=Decimal("0.00"),
            duration=timedelta(0),
            max_speed=speed_val,
            average_speed=speed_val
        )
        db.add(trip)
        return trip

    @staticmethod
    def update_active_trip(
        db: Session,
        active_trip: Trip,
        delta_distance_km: float,
        current_speed: Optional[float],
        current_time: datetime
    ) -> Trip:
        """Accumulate distance, update max speed, duration, and running average speed."""
        if delta_distance_km > 0:
            active_trip.distance = Decimal(str(round(float(active_trip.distance or 0) + delta_distance_km, 3)))

        if current_speed is not None and current_speed > float(active_trip.max_speed or 0):
            active_trip.max_speed = Decimal(str(round(current_speed, 2)))

        if current_time >= active_trip.start_time:
            active_trip.duration = current_time - active_trip.start_time
            duration_hours = active_trip.duration.total_seconds() / 3600.0
            if duration_hours > 0:
                calc_avg = float(active_trip.distance) / duration_hours
                active_trip.average_speed = Decimal(str(round(calc_avg, 2)))

        return active_trip

    @staticmethod
    def complete_active_trip(
        db: Session,
        active_trip: Trip,
        end_time: datetime
    ) -> Trip:
        """Finalize an ongoing trip upon idle timeout or session completion."""
        active_trip.end_time = end_time
        if end_time >= active_trip.start_time:
            active_trip.duration = end_time - active_trip.start_time
            duration_hours = active_trip.duration.total_seconds() / 3600.0
            if duration_hours > 0:
                calc_avg = float(active_trip.distance) / duration_hours
                active_trip.average_speed = Decimal(str(round(calc_avg, 2)))
        return active_trip

    @staticmethod
    def get_device_trips(
        db: Session,
        device: Device,
        limit: int = DEFAULT_TRIP_LIMIT
    ) -> List[Trip]:
        """
        Return recent trips for a device, newest first.
        Caller must already have verified device ownership.
        """
        capped_limit = max(1, min(limit, MAX_TRIP_LIMIT))
        return (
            db.query(Trip)
            .filter(Trip.device_id == device.id)
            .order_by(Trip.start_time.desc(), Trip.id.desc())
            .limit(capped_limit)
            .all()
        )

    @staticmethod
    def get_trip_by_id(
        db: Session,
        device: Device,
        trip_id: int
    ) -> Trip:
        """Retrieve a single trip ensuring it belongs to the given device."""
        trip = (
            db.query(Trip)
            .filter(Trip.id == trip_id, Trip.device_id == device.id)
            .first()
        )
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with ID {trip_id} not found on this device."
            )
        return trip

    @staticmethod
    def get_trip_route_locations(
        db: Session,
        device: Device,
        trip_id: int
    ) -> List[Location]:
        """Retrieve chronological GPS location points that belong to the given trip."""
        trip = TripService.get_trip_by_id(db, device, trip_id)
        query = db.query(Location).filter(
            Location.device_id == device.id,
            Location.timestamp >= trip.start_time
        )
        if trip.end_time is not None:
            query = query.filter(Location.timestamp <= trip.end_time)

        return query.order_by(Location.timestamp.asc(), Location.id.asc()).all()

    @staticmethod
    def get_device_trip_summary(
        db: Session,
        device: Device
    ) -> Dict[str, Any]:
        """Calculate aggregated trip statistics for the dashboard."""
        trips = (
            db.query(Trip)
            .filter(Trip.device_id == device.id)
            .all()
        )
        total_trips = len(trips)
        if total_trips == 0:
            return {
                "device_id": device.device_id,
                "total_trips": 0,
                "total_distance_km": 0.0,
                "average_trip_distance_km": 0.0,
                "longest_trip_distance_km": 0.0,
                "max_recorded_speed_kmh": 0.0,
                "last_trip_start_time": None
            }

        total_distance = sum(float(t.distance or 0.0) for t in trips)
        longest_trip = max(float(t.distance or 0.0) for t in trips)
        max_speed = max(float(t.max_speed or 0.0) for t in trips)
        avg_distance = total_distance / total_trips if total_trips > 0 else 0.0
        
        last_trip = max(trips, key=lambda t: t.start_time)

        return {
            "device_id": device.device_id,
            "total_trips": total_trips,
            "total_distance_km": round(total_distance, 2),
            "average_trip_distance_km": round(avg_distance, 2),
            "longest_trip_distance_km": round(longest_trip, 2),
            "max_recorded_speed_kmh": round(max_speed, 1),
            "last_trip_start_time": last_trip.start_time if last_trip else None
        }

