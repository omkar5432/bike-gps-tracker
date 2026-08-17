import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status

class InMemoryRateLimiter:
    """
    Lightweight in-memory sliding-window rate limiter.
    Suitable for single-instance deployments without external caching dependencies.
    """
    def __init__(self):
        # key -> list of timestamp floats
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: float = 60.0) -> bool:
        """
        Check if request is allowed under rate limit window.
        Cleans up expired timestamps automatically.
        """
        now = time.time()
        window_start = now - window_seconds
        
        # Filter timestamps within current window
        valid_timestamps = [t for t in self._requests[key] if t > window_start]
        self._requests[key] = valid_timestamps

        if len(valid_timestamps) >= max_requests:
            return False

        self._requests[key].append(now)
        return True

    def check_rate_limit(self, request: Request, key_prefix: str, max_requests: int, window_seconds: float = 60.0) -> None:
        """
        FastAPI dependency helper to enforce rate limit by client IP.
        Raises HTTP 429 if limit is exceeded.
        """
        client_ip = request.client.host if request.client else "unknown"
        key = f"{key_prefix}:{client_ip}"
        
        if not self.is_allowed(key, max_requests, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per {int(window_seconds)} seconds."
            )

rate_limiter = InMemoryRateLimiter()
