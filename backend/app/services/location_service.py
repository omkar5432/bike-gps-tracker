import math
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from ..models.device import Device, DeviceStatus
from ..models.location import Location
from ..models.geofence import Geofence
from ..models.alert import Alert
from ..models.trip import Trip
from ..schemas.location import LocationCreate
from .trip_service import (
    TripService,
    DEFAULT_TRIP_START_SPEED_KMH,
    DEFAULT_TRIP_IDLE_TIMEOUT_SECONDS,
    DEFAULT_MAX_GPS_JUMP_SPEED_KMH,
)

DEFAULT_HISTORY_LIMIT = 100
MAX_HISTORY_LIMIT = 500
DEFAULT_OVERSPEED_THRESHOLD_KMH = 80.0

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points in meters
    using the Haversine formula.
    """
    R = 6371000.0  # Earth's mean radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class LocationService:
    @staticmethod
    def ingest_location(
        db: Session,
        device: Device,
        location_in: LocationCreate
    ) -> Tuple[Location, List[Alert], Optional[Dict[str, Any]]]:
        """
        Persist GPS telemetry point, update device state, evaluate
        geofence state transitions (ENTER / EXIT), overspeed conditions,
        and manage automatic trip lifecycle (start, distance accumulation, idle completion).
        
        Args:
            db: Database session
            device: Authenticated device
            location_in: Validated location data
        
        Returns:
            Tuple of (Created Location, List of generated Alerts, Optional trip event dict)
        """
        try:
            # 1. Retrieve the immediate previous location scalar fields (no PostGIS WKB decode overhead)
            prev_location = (
                db.query(Location.latitude, Location.longitude, Location.speed, Location.timestamp)
                .filter(Location.device_id == device.id)
                .order_by(Location.timestamp.desc(), Location.id.desc())
                .first()
            )

            # 2. Create and persist new Location ORM instance
            location = Location(
                device_id=device.id,
                latitude=location_in.latitude,
                longitude=location_in.longitude,
                speed=location_in.speed,
                altitude=location_in.altitude,
                battery=location_in.battery,
                gps_accuracy=location_in.gps_accuracy,
                satellites=location_in.satellites,
                timestamp=location_in.timestamp
            )
            db.add(location)

            # 3. Update device state
            device.last_seen = location_in.timestamp
            device.status = DeviceStatus.ONLINE

            # Flush location & device state to obtain generated IDs without early commit
            db.flush()

            # 4. Automatic Trip Lifecycle Management
            trip_start_speed = float(os.getenv("TRIP_START_SPEED_KMH", str(DEFAULT_TRIP_START_SPEED_KMH)))
            trip_idle_timeout = float(os.getenv("TRIP_IDLE_TIMEOUT_SECONDS", str(DEFAULT_TRIP_IDLE_TIMEOUT_SECONDS)))
            max_jump_speed = float(os.getenv("MAX_GPS_JUMP_SPEED_KMH", str(DEFAULT_MAX_GPS_JUMP_SPEED_KMH)))

            curr_speed = float(location_in.speed) if location_in.speed is not None else 0.0
            curr_time = location_in.timestamp
            active_trip = TripService.get_active_trip(db, device)
            trip_event: Optional[Dict[str, Any]] = None

            if active_trip is not None:
                if prev_location is not None:
                    dt = (curr_time - prev_location.timestamp).total_seconds()
                    if dt > trip_idle_timeout:
                        # Inactivity timeout reached -> complete previous active trip
                        TripService.complete_active_trip(db, active_trip, prev_location.timestamp)
                        trip_event = {"event": "trip_completed", "trip": active_trip}
                        
                        # If device is now moving, start a new active trip
                        if curr_speed >= trip_start_speed:
                            new_trip = TripService.start_trip(db, device, curr_time, curr_speed)
                            trip_event = {"event": "trip_started", "trip": new_trip}
                    else:
                        # Ongoing trip -> compute distance delta with jump filtering
                        dist_m = haversine_distance_meters(
                            float(prev_location.latitude), float(prev_location.longitude),
                            float(location_in.latitude), float(location_in.longitude)
                        )
                        dist_km = dist_m / 1000.0

                        is_valid_jump = True
                        if dt > 0:
                            calc_speed_kmh = dist_km / (dt / 3600.0)
                            if calc_speed_kmh > max_jump_speed:
                                is_valid_jump = False
                        elif dist_km > 2.0:
                            is_valid_jump = False

                        delta_to_add = dist_km if is_valid_jump else 0.0
                        TripService.update_active_trip(db, active_trip, delta_to_add, curr_speed, curr_time)
                        trip_event = {"event": "trip_updated", "trip": active_trip}
                else:
                    # No prev location but active trip exists
                    TripService.update_active_trip(db, active_trip, 0.0, curr_speed, curr_time)
                    trip_event = {"event": "trip_updated", "trip": active_trip}
            else:
                # No active trip -> check if movement threshold met
                if curr_speed >= trip_start_speed:
                    new_trip = TripService.start_trip(db, device, curr_time, curr_speed)
                    trip_event = {"event": "trip_started", "trip": new_trip}

            # 5. Geofence & Overspeed Detection
            generated_alerts: List[Alert] = []

            # Check Geofence transitions if a previous location exists
            if prev_location is not None:
                enabled_geofences = (
                    db.query(Geofence)
                    .filter(Geofence.device_id == device.id, Geofence.enabled == True)  # noqa: E712
                    .all()
                )

                curr_lat = float(location_in.latitude)
                curr_lon = float(location_in.longitude)
                prev_lat = float(prev_location.latitude)
                prev_lon = float(prev_location.longitude)

                for geo in enabled_geofences:
                    geo_lat = float(geo.latitude)
                    geo_lon = float(geo.longitude)
                    geo_radius = float(geo.radius)

                    prev_dist = haversine_distance_meters(prev_lat, prev_lon, geo_lat, geo_lon)
                    curr_dist = haversine_distance_meters(curr_lat, curr_lon, geo_lat, geo_lon)

                    prev_inside = prev_dist <= geo_radius
                    curr_inside = curr_dist <= geo_radius

                    # OUTSIDE -> INSIDE = GEOFENCE_ENTER
                    if not prev_inside and curr_inside:
                        alert = Alert(
                            device_id=device.id,
                            type="GEOFENCE_ENTER",
                            message=f"Bike entered geofence: {geo.name}",
                            latitude=location_in.latitude,
                            longitude=location_in.longitude,
                            acknowledged=False
                        )
                        db.add(alert)
                        generated_alerts.append(alert)

                    # INSIDE -> OUTSIDE = GEOFENCE_EXIT
                    elif prev_inside and not curr_inside:
                        alert = Alert(
                            device_id=device.id,
                            type="GEOFENCE_EXIT",
                            message=f"Bike exited geofence: {geo.name}",
                            latitude=location_in.latitude,
                            longitude=location_in.longitude,
                            acknowledged=False
                        )
                        db.add(alert)
                        generated_alerts.append(alert)

            # Check Overspeed condition
            overspeed_threshold = float(
                os.getenv("OVERSPEED_THRESHOLD_KMH", str(DEFAULT_OVERSPEED_THRESHOLD_KMH))
            )
            if location_in.speed is not None and float(location_in.speed) > overspeed_threshold:
                prev_overspeed = (
                    prev_location is not None
                    and prev_location.speed is not None
                    and float(prev_location.speed) > overspeed_threshold
                )
                # Avoid duplicate alert on continuous speeding
                if not prev_overspeed:
                    alert = Alert(
                        device_id=device.id,
                        type="OVERSPEED",
                        message=f"Speed limit exceeded: {float(location_in.speed):.1f} km/h (threshold: {overspeed_threshold:.1f} km/h)",
                        latitude=location_in.latitude,
                        longitude=location_in.longitude,
                        acknowledged=False
                    )
                    db.add(alert)
                    generated_alerts.append(alert)

            # Flush any alerts/trip models so generated values are populated
            if generated_alerts or (trip_event and "trip" in trip_event):
                db.flush()

            # Single atomic commit for the entire location ingestion transaction
            db.commit()

            return location, generated_alerts, trip_event

        except Exception:
            db.rollback()
            raise

    @staticmethod
    def get_location_history(
        db: Session,
        device: Device,
        limit: int = DEFAULT_HISTORY_LIMIT
    ) -> List[Location]:
        """
        Return recent locations for a device, newest first.
        Caller must already have verified device ownership.
        """
        capped_limit = max(1, min(limit, MAX_HISTORY_LIMIT))
        return (
            db.query(Location)
            .filter(Location.device_id == device.id)
            .order_by(Location.timestamp.desc())
            .limit(capped_limit)
            .all()
        )

