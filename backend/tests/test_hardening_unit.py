import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from backend.app.main import app
from backend.app.core.config import Settings
from backend.app.core.rate_limiter import InMemoryRateLimiter
from backend.app.core.device_auth import authenticate_device
from backend.app.models.device import Device, DeviceStatus


@pytest.fixture
def client():
    return TestClient(app)


def test_liveness_probe(client):
    """Test GET /health returns 200 OK with minimal status."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_readiness_probe_success(client):
    """Test GET /health/ready returns 200 OK when database is connected."""
    with patch("backend.app.main.engine.connect") as mock_connect:
        mock_conn = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn
        res = client.get("/health/ready")
        assert res.status_code == 200
        assert res.json() == {"status": "ready", "database": "ok"}


def test_readiness_probe_database_failure_returns_503(client):
    """Test GET /health/ready returns 503 and hides internal credentials when db is unreachable."""
    with patch("backend.app.main.engine.connect", side_effect=Exception("FATAL: password authentication failed")):
        res = client.get("/health/ready")
        assert res.status_code == 503
        assert res.json() == {"status": "not_ready", "database": "unreachable"}
        # Must not leak the exception text with passwords
        assert "password" not in str(res.json()).lower()


def test_in_memory_rate_limiter():
    """Test sliding window rate limiter allows up to max requests and blocks excess."""
    limiter = InMemoryRateLimiter()
    key = "test_client:127.0.0.1"

    # Limit = 3 requests per 10 seconds
    assert limiter.is_allowed(key, max_requests=3, window_seconds=10.0) is True
    assert limiter.is_allowed(key, max_requests=3, window_seconds=10.0) is True
    assert limiter.is_allowed(key, max_requests=3, window_seconds=10.0) is True
    # 4th request within window is rejected
    assert limiter.is_allowed(key, max_requests=3, window_seconds=10.0) is False


def test_inactive_device_rejected():
    """Test that deactivated device is rejected with 403 Forbidden."""
    mock_db = MagicMock()
    inactive_device = Device(
        id=1,
        device_id="INACTIVE-DEV",
        user_id="00000000-0000-0000-0000-000000000001",
        status=DeviceStatus.INACTIVE,
        device_secret_hash="fakehash"
    )
    mock_db.query.return_value.filter.return_value.first.return_value = inactive_device

    with patch("backend.app.core.device_auth.verify_device_secret", return_value=True):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            authenticate_device(
                x_device_id="INACTIVE-DEV",
                x_device_secret="rawsecret",
                db=mock_db
            )
        assert exc_info.value.status_code == 403
        assert "deactivated" in exc_info.value.detail.lower()


def test_config_validation_missing_database_url_fails():
    """Test that startup validation raises error if DATABASE_URL is missing."""
    with patch.object(Settings, "DATABASE_URL", ""):
        with pytest.raises(ValueError) as exc:
            Settings.validate_configuration()
        assert "DATABASE_URL" in str(exc.value)


def test_config_validation_production_mode():
    """Test that production environment requires Supabase credentials and custom JWT secret."""
    with patch.object(Settings, "ENVIRONMENT", "production"), \
         patch.object(Settings, "SUPABASE_URL", None), \
         patch.object(Settings, "DATABASE_URL", "postgresql://user:pass@localhost/db"):
        with pytest.raises(ValueError) as exc:
            Settings.validate_configuration()
        assert "SUPABASE_URL" in str(exc.value)
