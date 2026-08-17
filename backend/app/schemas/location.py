from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

class LocationCreate(BaseModel):
    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Latitude in decimal degrees (-90 to +90)"
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Longitude in decimal degrees (-180 to +180)"
    )
    speed: Optional[float] = Field(
        None,
        ge=0.0,
        description="Speed in km/h (non-negative)"
    )
    altitude: Optional[float] = Field(
        None,
        description="Altitude in meters above sea level"
    )
    battery: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Battery percentage (0.0 to 100.0)"
    )
    gps_accuracy: Optional[float] = Field(
        None,
        ge=0.0,
        description="GPS horizontal dilution / accuracy in meters"
    )
    satellites: Optional[int] = Field(
        None,
        ge=0,
        description="Number of satellites tracked"
    )
    timestamp: datetime = Field(
        ...,
        description="ISO-8601 UTC timestamp of the GPS reading"
    )

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_tz(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("Timestamp must include timezone information (e.g. UTC 'Z' or offset).")
        return v

    model_config = ConfigDict(from_attributes=True)

class LocationResponse(BaseModel):
    id: int
    device_id: str
    latitude: float
    longitude: float
    speed: Optional[float] = None
    altitude: Optional[float] = None
    battery: Optional[float] = None
    gps_accuracy: Optional[float] = None
    satellites: Optional[int] = None
    timestamp: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
