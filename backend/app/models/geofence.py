from sqlalchemy import Column, BigInteger, String, Numeric, DateTime, Boolean, func, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from ..database.base import Base

class Geofence(Base):
    __tablename__ = "geofences"
    __table_args__ = {"schema": "bike_gps"}

    id = Column(BigInteger, primary_key=True)
    device_id = Column(BigInteger, ForeignKey("bike_gps.devices.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    radius = Column(Numeric(10, 2), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)

    device = relationship("Device", back_populates="geofences")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if "longitude" in kwargs and "latitude" in kwargs:
            self.geom = f"POINT({kwargs['longitude']} {kwargs['latitude']})"
