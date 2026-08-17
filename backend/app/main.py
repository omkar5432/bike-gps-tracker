import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from .core.config import settings
from .database.connection import engine, SessionLocal
from . import models
from .api.v1.devices import router as devices_router
from .api.v1.locations import router as locations_router
from .api.v1.trips import router as trips_router
from .api.v1.websocket import router as websocket_router
from .api.v1.geofences import router as geofences_router
from .api.v1.alerts import router as alerts_router

# Configure root logger with safe structured format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("bike_tracker")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation
    try:
        settings.validate_configuration()
        # Pre-warm DB connection pool at startup to eliminate cold-request latency spike
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection pool pre-warmed successfully")
    except Exception as e:
        logger.critical(f"Startup configuration error: {e}")
        raise
    yield


app = FastAPI(
    title="Bike GPS Tracker API",
    description="Production-grade personal bike GPS tracking backend",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Structured Request Logging Middleware (Sanitizing secrets and tokens)
@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    start_time = time.time()
    path = request.url.path
    method = request.method

    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        # Log HTTP requests safely without logging Authorization or token headers
        if not path.startswith("/health"):
            logger.info(f"{method} {path} -> {response.status_code} ({duration_ms}ms)")
        return response
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"{method} {path} -> Unhandled exception ({duration_ms}ms): {type(exc).__name__}")
        raise


# Global Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Return clear, sanitized validation errors without leaking sensitive payload structure
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        errors.append(f"{loc}: {err.get('msg', 'invalid value')}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors}
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    # Log the full database error internally on server, return safe generic message to client
    logger.error(f"Database error during request {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database operation failed"}
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server exception during {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


# Register API routers
app.include_router(devices_router, prefix="/api/v1")
app.include_router(locations_router, prefix="/api/v1")
app.include_router(trips_router, prefix="/api/v1")
app.include_router(websocket_router, prefix="/api/v1")
app.include_router(geofences_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")


# Health Checks
@app.get("/health", summary="Liveness Probe", tags=["System"])
async def liveness_check():
    """Lightweight liveness probe verifying the application process is running."""
    return {"status": "ok"}


@app.get("/health/ready", summary="Readiness Probe", tags=["System"])
async def readiness_check():
    """
    Readiness probe verifying database connectivity without exposing connection strings or credentials.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception as e:
        logger.error(f"Readiness probe database check failed: {type(e).__name__}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "database": "unreachable"}
        )

