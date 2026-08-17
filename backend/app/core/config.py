import os
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class Settings:
    """
    Centralized application configuration with startup validation.
    Ensures required environment variables exist without exposing secret values.
    """
    # Environment & Host
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    if not DATABASE_URL:
        user = os.getenv("POSTGRES_USER", "postgres_user")
        password = os.getenv("POSTGRES_PASSWORD", "postgres_password")
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        db = os.getenv("POSTGRES_DB", "bike_gps_tracker")
        DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{db}"

    # Supabase & Authentication
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "fallback_secret_key_change_in_production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    DEVICE_SECRET_KEY: Optional[str] = os.getenv("DEVICE_SECRET_KEY")

    # GPS & Telemetry Thresholds
    TRIP_START_SPEED_KMH: float = float(os.getenv("TRIP_START_SPEED_KMH", "5.0"))
    TRIP_IDLE_TIMEOUT_SECONDS: float = float(os.getenv("TRIP_IDLE_TIMEOUT_SECONDS", "300.0"))
    MAX_GPS_JUMP_SPEED_KMH: float = float(os.getenv("MAX_GPS_JUMP_SPEED_KMH", "150.0"))
    OVERSPEED_THRESHOLD_KMH: float = float(os.getenv("OVERSPEED_THRESHOLD_KMH", "80.0"))

    # Rate Limiting (In-Memory Sliding Window)
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in ("true", "1", "yes")
    AUTH_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "60"))
    GPS_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("GPS_RATE_LIMIT_PER_MINUTE", "120"))

    # Device Authentication Cache TTL (seconds)
    DEVICE_AUTH_CACHE_TTL_SECONDS: int = int(os.getenv("DEVICE_AUTH_CACHE_TTL_SECONDS", "45"))

    @classmethod
    def validate_configuration(cls) -> None:
        """
        Validate presence and correctness of environment variables at startup.
        Fails fast if critical settings are missing, naming the variable without leaking secrets.
        """
        missing = []
        if not cls.DATABASE_URL:
            missing.append("DATABASE_URL")

        if cls.ENVIRONMENT == "production":
            if not cls.SUPABASE_URL:
                missing.append("SUPABASE_URL")
            if not cls.SUPABASE_ANON_KEY:
                missing.append("SUPABASE_ANON_KEY")
            if cls.JWT_SECRET_KEY == "fallback_secret_key_change_in_production":
                missing.append("JWT_SECRET_KEY (must not use fallback in production)")

        if missing:
            msg = f"Configuration validation failed. Missing required variables: {', '.join(missing)}"
            logger.critical(msg)
            raise ValueError(msg)

        logger.info(f"Configuration validated successfully for environment: {cls.ENVIRONMENT}")

settings = Settings()
