from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models.device import Device
from ..models.geofence import Geofence
from ..schemas.geofence import GeofenceCreate, GeofenceUpdate

class GeofenceService:
    @staticmethod
    def create_geofence(db: Session, device: Device, geofence_in: GeofenceCreate) -> Geofence:
        """Create and persist a new geofence for the given device."""
        try:
            geofence = Geofence(
                device_id=device.id,
                name=geofence_in.name,
                latitude=geofence_in.latitude,
                longitude=geofence_in.longitude,
                radius=geofence_in.radius,
                enabled=geofence_in.enabled
            )
            db.add(geofence)
            db.commit()
            db.refresh(geofence)
            return geofence
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def get_geofences_for_device(db: Session, device: Device) -> List[Geofence]:
        """Retrieve all geofences belonging to a device."""
        return (
            db.query(Geofence)
            .filter(Geofence.device_id == device.id)
            .order_by(Geofence.id.asc())
            .all()
        )

    @staticmethod
    def get_geofence_by_id(db: Session, device: Device, geofence_id: int) -> Geofence:
        """Retrieve a specific geofence ensuring it belongs to the given device."""
        geofence = (
            db.query(Geofence)
            .filter(Geofence.id == geofence_id, Geofence.device_id == device.id)
            .first()
        )
        if not geofence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Geofence with ID {geofence_id} not found on this device."
            )
        return geofence

    @staticmethod
    def update_geofence(
        db: Session,
        device: Device,
        geofence_id: int,
        geofence_in: GeofenceUpdate
    ) -> Geofence:
        """Update properties of an existing geofence."""
        geofence = GeofenceService.get_geofence_by_id(db, device, geofence_id)
        
        try:
            if geofence_in.name is not None:
                geofence.name = geofence_in.name
            if geofence_in.radius is not None:
                geofence.radius = geofence_in.radius
            if geofence_in.enabled is not None:
                geofence.enabled = geofence_in.enabled
            
            coord_changed = False
            if geofence_in.latitude is not None:
                geofence.latitude = geofence_in.latitude
                coord_changed = True
            if geofence_in.longitude is not None:
                geofence.longitude = geofence_in.longitude
                coord_changed = True
            
            if coord_changed:
                geofence.geom = f"POINT({geofence.longitude} {geofence.latitude})"

            db.commit()
            db.refresh(geofence)
            return geofence
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def delete_geofence(db: Session, device: Device, geofence_id: int) -> bool:
        """Delete an existing geofence."""
        geofence = GeofenceService.get_geofence_by_id(db, device, geofence_id)
        try:
            db.delete(geofence)
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def set_geofence_status(db: Session, device: Device, geofence_id: int, enabled: bool) -> Geofence:
        """Enable or disable a geofence."""
        geofence = GeofenceService.get_geofence_by_id(db, device, geofence_id)
        try:
            geofence.enabled = enabled
            db.commit()
            db.refresh(geofence)
            return geofence
        except Exception:
            db.rollback()
            raise
