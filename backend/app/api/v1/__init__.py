# api v1 package
from .devices import router as devices_router
from .locations import router as locations_router
from .trips import router as trips_router
from .websocket import router as websocket_router
from .geofences import router as geofences_router
from .alerts import router as alerts_router
