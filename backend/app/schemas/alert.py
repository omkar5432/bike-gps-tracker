from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class AlertResponse(BaseModel):
    id: int
    device_id: str
    type: str
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AlertAcknowledgeResponse(BaseModel):
    id: int
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
