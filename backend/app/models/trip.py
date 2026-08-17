from sqlalchemy import Column, BigInteger, Numeric, DateTime, func, ForeignKey, Interval
from sqlalchemy.orm import relationship
from ..database.base import Base

class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = {"schema": "bike_gps"}

    id = Column(BigInteger, primary_key=True)
    device_id = Column(BigInteger, ForeignKey("bike_gps.devices.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    distance = Column(Numeric(12, 2), nullable=False, default=0)
    duration = Column(Interval, nullable=True)
    max_speed = Column(Numeric(8, 2), nullable=False, default=0)
    average_speed = Column(Numeric(8, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    device = relationship("Device", back_populates="trips")
