import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
from jose import jwt, JWTError
from supabase import create_client, Client

import bcrypt

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_secret_key_change_in_production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Supabase configuration for JWT verification
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# For testing purposes, if Supabase credentials are not set, fall back to local JWT verification
USE_SUPABASE_AUTH = bool(SUPABASE_URL and SUPABASE_ANON_KEY)

def generate_device_secret(nbytes: int = 32) -> str:
    """Generate a cryptographically secure random device secret."""
    return secrets.token_urlsafe(nbytes)

def hash_device_secret(secret: str) -> str:
    """Hash a device secret using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(secret.encode("utf-8"), salt).decode("utf-8")

def verify_device_secret(plain_secret: str, hashed_secret: str) -> bool:
    """Verify a plain device secret against its stored hash using constant-time comparison."""
    if not plain_secret or not hashed_secret:
        return False
    try:
        return bcrypt.checkpw(plain_secret.encode("utf-8"), hashed_secret.encode("utf-8"))
    except Exception:
        return False


def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Validate a JWT access token.
    First checks against local JWT secret (instant, 0 network latency).
    If that does not match, verifies via Supabase Auth.
    Always returns a dict with a `sub` claim (user UUID) when successful.
    """
    # 1. Check if token was signed locally
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": True}
        )
        user_id = payload.get("sub") or payload.get("user_id") or payload.get("id")
        if user_id:
            payload["sub"] = str(user_id)
            return payload
    except Exception:
        pass

    # 2. Check with Supabase cloud auth for frontend Supabase tokens
    if USE_SUPABASE_AUTH:
        try:
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)
            user = supabase.auth.get_user(token)

            if not user:
                raise ValueError("Invalid Supabase token")

            user_dict = None
            if hasattr(user, 'user') and user.user:
                if hasattr(user.user, 'model_dump'):
                    user_dict = user.user.model_dump()
                elif hasattr(user.user, 'dict'):
                    user_dict = user.user.dict()
                elif hasattr(user.user, '__dict__'):
                    user_dict = dict(user.user.__dict__)
                else:
                    user_dict = dict(user.user)
            elif hasattr(user, 'model_dump'):
                user_dict = user.model_dump()
            elif hasattr(user, 'dict'):
                user_dict = user.dict()
            elif hasattr(user, '__dict__'):
                user_dict = dict(user.__dict__)
            else:
                user_dict = dict(user)

            if not isinstance(user_dict, dict):
                user_dict = {"id": str(user_dict)}

            # Normalize: Supabase User uses `id`; JWT claims use `sub`
            user_id = user_dict.get("sub") or user_dict.get("user_id") or user_dict.get("id")
            if not user_id:
                raise ValueError("Invalid token payload: missing user UUID")
            user_dict["sub"] = str(user_id)

            return user_dict
        except Exception as e:
            raise ValueError(f"Invalid Supabase token: {str(e)}")

    raise ValueError("Invalid authentication token")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token (used for testing and authentication helpers)."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta if expires_delta else timedelta(hours=1))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt
