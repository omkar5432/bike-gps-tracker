import math
import random
from datetime import datetime, timezone
from typing import Dict, Any

class GPSSimulator:
    """
    Simulates physical GPS hardware movement, battery discharge,
    and telemetry sensor readings along a smooth trajectory.
    """

    def __init__(
        self,
        start_lat: float = 18.520430,
        start_lon: float = 73.856744,
        target_speed: float = 25.0,
        start_battery: float = 100.0,
        start_altitude: float = 560.0,
        heading_deg: float = 45.0
    ):
        self.lat = start_lat
        self.lon = start_lon
        self.target_speed = target_speed
        self.current_speed = target_speed
        self.battery = start_battery
        self.altitude = start_altitude
        self.heading = heading_deg  # In degrees (0 = North, 90 = East, etc.)
        self.satellites = 10
        self.accuracy = 3.5

    def step(self, interval_seconds: float = 5.0) -> Dict[str, Any]:
        """
        Advance one simulation step: compute new GPS coordinate,
        update battery, vary speed gently, and format payload.
        """
        # Smooth speed variation (+/- 1.5 km/h)
        speed_delta = (random.random() - 0.5) * 3.0
        self.current_speed = max(0.0, min(80.0, self.target_speed + speed_delta))

        # Smooth heading drift (+/- 5 degrees)
        heading_delta = (random.random() - 0.5) * 10.0
        self.heading = (self.heading + heading_delta) % 360.0

        # Calculate distance traveled in kilometers
        distance_km = self.current_speed * (interval_seconds / 3600.0)

        # Earth radius in km
        earth_radius = 6371.0
        heading_rad = math.radians(self.heading)
        lat_rad = math.radians(self.lat)

        # Geodesic displacement
        delta_lat = (distance_km / earth_radius) * math.cos(heading_rad)
        delta_lon = (distance_km / earth_radius) * math.sin(heading_rad) / math.cos(lat_rad)

        self.lat += math.degrees(delta_lat)
        self.lon += math.degrees(delta_lon)

        # Subtle altitude fluctuation
        self.altitude += (random.random() - 0.5) * 1.0

        # Gradual battery drain (0.02% per step)
        self.battery = max(0.0, self.battery - (0.02 * (interval_seconds / 5.0)))

        # Realistic GPS accuracy (2.0 - 5.0 meters) and satellites (8 - 12)
        self.accuracy = round(3.0 + (random.random() - 0.5) * 1.5, 2)
        self.satellites = max(6, min(14, int(10 + (random.random() - 0.5) * 4)))

        timestamp_utc = datetime.now(timezone.utc).isoformat()

        return {
            "latitude": round(self.lat, 6),
            "longitude": round(self.lon, 6),
            "speed": round(self.current_speed, 2),
            "altitude": round(self.altitude, 2),
            "battery": round(self.battery, 2),
            "gps_accuracy": self.accuracy,
            "satellites": self.satellites,
            "timestamp": timestamp_utc
        }
