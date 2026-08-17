from sqlalchemy import Column, BigInteger, String, DateTime, func, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database.base import Base

class DeviceStatus:
    ONLINE = "ONLINE"
    RECENTLY_SEEN = "RECENTLY_SEEN"
    DELAYED = "DELAYED"
    OFFLINE = "OFFLINE"
    INACTIVE = "INACTIVE"

class Device(Base):
    __tablename__ = "devices"
    __table_args__ = {"schema": "bike_gps"}

    id = Column(BigInteger, primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    device_id = Column(String(100), nullable=False)
    name = Column(String(100), nullable=False)
    imei = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default=DeviceStatus.OFFLINE)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    device_secret_hash = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    locations = relationship("Location", back_populates="device", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="device", cascade="all, delete-orphan")
    geofences = relationship("Geofence", back_populates="device", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="device", cascade="all, delete-orphan")
