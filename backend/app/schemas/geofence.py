from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class GeofenceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name or label for the geofence zone")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Center latitude in decimal degrees (-90 to +90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Center longitude in decimal degrees (-180 to +180)")
    radius: float = Field(..., gt=0.0, description="Radius in meters (must be > 0)")
    enabled: bool = Field(True, description="Whether the geofence is actively monitored")

    model_config = ConfigDict(from_attributes=True)

class GeofenceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name or label for the geofence zone")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Center latitude in decimal degrees (-90 to +90)")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Center longitude in decimal degrees (-180 to +180)")
    radius: Optional[float] = Field(None, gt=0.0, description="Radius in meters (must be > 0)")
    enabled: Optional[bool] = Field(None, description="Whether the geofence is actively monitored")

    model_config = ConfigDict(from_attributes=True)

class GeofenceResponse(BaseModel):
    id: int
    device_id: str
    name: str
    latitude: float
    longitude: float
    radius: float
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
