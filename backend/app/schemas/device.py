from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class DeviceCreate(BaseModel):
    device_id: str = Field(..., min_length=3, max_length=100, description="Unique hardware identifier for the GPS device")
    name: Optional[str] = Field(None, max_length=255, description="Human-readable nickname for the bike/device")
    imei: Optional[str] = Field(None, max_length=50, description="IMEI number of the cellular module")

    model_config = ConfigDict(from_attributes=True)

class DeviceResponse(BaseModel):
    id: int
    device_id: str
    name: Optional[str] = None
    imei: Optional[str] = None
    status: str
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DeviceRegistrationResponse(BaseModel):
    id: int
    device_id: str
    name: Optional[str] = None
    imei: Optional[str] = None
    status: str
    created_at: datetime
    device_secret: str = Field(..., description="Raw device secret returned ONLY ONCE upon registration")

    model_config = ConfigDict(from_attributes=True)
