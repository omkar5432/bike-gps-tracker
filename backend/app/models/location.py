from sqlalchemy import Column, BigInteger, Integer, Numeric, DateTime, func, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from ..database.base import Base

class Location(Base):
    __tablename__ = "locations"
    __table_args__ = {"schema": "bike_gps"}

    id = Column(BigInteger, primary_key=True)
    device_id = Column(BigInteger, ForeignKey("bike_gps.devices.id", ondelete="CASCADE"), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    speed = Column(Numeric(8, 2), nullable=False, default=0)
    altitude = Column(Numeric(10, 2), nullable=True)
    battery = Column(Numeric(5, 2), nullable=True)
    gps_accuracy = Column(Numeric(8, 2), nullable=True)
    satellites = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)

    device = relationship("Device", back_populates="locations")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if "longitude" in kwargs and "latitude" in kwargs:
            lon = kwargs["longitude"]
            lat = kwargs["latitude"]
            self.geom = f"POINT({lon} {lat})"
