# backend/app/middleware/rate_limiter.py

import logging

from fastapi import HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from ..utils.redis_client import get_redis

logger = logging.getLogger(__name__)

# Rate limit rules per route pattern
# Format: (max_requests, window_seconds)
RATE_LIMITS = {
    "/api/v1/auth/login": (5, 900),       # 5 per 15 min — brute force protection
    "/api/v1/auth/register": (3, 3600),    # 3 per hour — abuse prevention
}

# Global fallback for all other routes
GLOBAL_RATE_LIMIT = (100, 60)  # 100 per minute per IP


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-based sliding window rate limiter.

    Uses a per-IP counter in Redis with TTL.
    Auth endpoints get stricter limits than general API routes.
    """

    async def dispatch(self, request: Request, call_next):
        client_ip = request.headers.get("X-Forwarded-For", request.client.host)
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        path = request.url.path
        max_requests, window = RATE_LIMITS.get(path, GLOBAL_RATE_LIMIT)

        redis_key = f"rate_limit:{path}:{client_ip}"

        try:
            redis = await get_redis()
            current = await redis.incr(redis_key)

            if current == 1:
                await redis.expire(redis_key, window)

            if current > max_requests:
                ttl = await redis.ttl(redis_key)
                logger.warning(
                    "Rate limit exceeded: ip=%s path=%s count=%s limit=%s",
                    client_ip, path, current, max_requests,
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests",
                    headers={"Retry-After": str(ttl)},
                )

        except HTTPException:
            raise
        except Exception as e:
            # Redis down — fail open rather than blocking everyone
            logger.error("Rate limiter Redis error: %s", e)

        response = await call_next(request)
        return response