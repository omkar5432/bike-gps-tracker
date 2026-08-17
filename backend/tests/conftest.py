import os
import sys
from pathlib import Path
import pytest
import tempfile
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Ensure project root is in sys.path
PROJECT_ROOT = str(Path(__file__).resolve().parents[2])
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load .env file - use explicit path for Bike GPS Tracker
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)

from backend.app.database.base import Base
from backend.app.models import Device, Location, Trip, Geofence, Alert

# Get test database URL - PostgreSQL/PostGIS required for schema support
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

@pytest.fixture(scope="session")
def engine():
    """Create SQLAlchemy engine for test database.
    
    REQUIREMENTS:
    - TEST_DATABASE_URL environment variable must be set
    - Database must be PostgreSQL 15+ with PostGIS extension
    - DO NOT use the production Supabase DATABASE_URL
    
    CONFIGURATION:
    - Create a dedicated test database (e.g., test_bike_gps)
    - Enable PostGIS: CREATE EXTENSION IF NOT EXISTS postgis;
    - Update .env with: TEST_DATABASE_URL=postgresql://user:pass@host:port/test_bike_gps
    """
    if not TEST_DATABASE_URL:
        raise RuntimeError(
            "TEST_DATABASE_URL environment variable is required for integration tests.\n"
            "Set it in .env file:\n"
            "  TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/test_bike_gps\n"
            "\nIMPORTANT: Do NOT use the production DATABASE_URL (Supabase) for testing.\n"
            "The test suite creates/drops the bike_gps schema and may affect production data."
        )
    
    if "sqlite" in TEST_DATABASE_URL:
        raise RuntimeError(
            "SQLite is not supported for Bike GPS Tracker integration tests.\n"
            "SQLite does not support PostgreSQL schemas like 'bike_gps' or PostGIS geography types.\n"
            "Use a PostgreSQL/PostGIS database for TEST_DATABASE_URL."
        )
    
    print(f"\n=== Connecting to test database ===")
    print(f"TEST_DATABASE_URL: {TEST_DATABASE_URL[:50]}... (hidden)")
    
    # Verify PostgreSQL with PostGIS
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    
    # Check if PostGIS is available
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT PostGIS_Version()"))
            postgis_version = result.scalar()
            print(f"PostGIS Version: {postgis_version}")
            if not postgis_version:
                raise RuntimeError(
                    "PostGIS extension not found in test database.\n"
                    "Connect to your test database and run:\n"
                    "  CREATE EXTENSION IF NOT EXISTS postgis;"
                )
    except Exception as e:
        raise RuntimeError(
            f"Failed to verify PostGIS in test database: {e}\n"
            "Ensure TEST_DATABASE_URL points to a PostgreSQL database with PostGIS extension installed.\n"
            "DO NOT use the production Supabase database for testing."
        )
    
    # Create bike_gps schema for testing
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS bike_gps CASCADE"))
        conn.execute(text("CREATE SCHEMA bike_gps"))
        conn.commit()
    
    print("Created bike_gps schema")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Created all tables in bike_gps schema")

    yield engine

    # Drop schema/tables after tests
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    print("Test database cleanup complete")

@pytest.fixture(scope="function")
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = Session()

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    from fastapi.testclient import TestClient
    from backend.app.main import app
    from backend.app.core.auth import get_db as auth_get_db
    from backend.app.core.device_auth import get_db as dev_get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[auth_get_db] = override_get_db
    app.dependency_overrides[dev_get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def test_user_a_uuid():
    return "ba8cf4d1-2ba4-43b2-99aa-f2a125cb5d41"

@pytest.fixture(scope="function")
def test_user_b_uuid():
    return "bb8cf4d1-2ba4-43b2-99aa-f2a125cb5d42"

@pytest.fixture(scope="function")
def db_session_with_uuid_fix(db_session):
    """Fixture that ensures db_session has proper fixtures for tests that need it."""
    return db_session

@pytest.fixture(scope="function")
def auth_headers_user_a(test_user_a_uuid):
    from backend.app.core.security import create_access_token
    token = create_access_token({"sub": test_user_a_uuid, "email": "usera@example.com"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="function")
def auth_headers_user_b(test_user_b_uuid):
    from backend.app.core.security import create_access_token
    token = create_access_token({"sub": test_user_b_uuid, "email": "userb@example.com"})
    return {"Authorization": f"Bearer {token}"}
