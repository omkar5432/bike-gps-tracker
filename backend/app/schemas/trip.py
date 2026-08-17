from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TripResponse(BaseModel):
    id: int
    device_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    distance: float
    duration: Optional[str] = None
    max_speed: float
    average_speed: float
    created_at: datetime
    status: str = "COMPLETED"

    model_config = ConfigDict(from_attributes=True)


class TripSummaryResponse(BaseModel):
    device_id: str
    total_trips: int
    total_distance_km: float
    average_trip_distance_km: float
    longest_trip_distance_km: float
    max_recorded_speed_kmh: float
    last_trip_start_time: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

