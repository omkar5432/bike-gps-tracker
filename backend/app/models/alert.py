from sqlalchemy import Column, BigInteger, String, Numeric, DateTime, func, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from ..database.base import Base

class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = {"schema": "bike_gps"}

    id = Column(BigInteger, primary_key=True)
    device_id = Column(BigInteger, ForeignKey("bike_gps.devices.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    device = relationship("Device", back_populates="alerts")
