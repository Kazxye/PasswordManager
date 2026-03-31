import logging

import redis.asyncio as aioredis

from ..config import settings

logger = logging.getLogger(__name__)

# Singleton — created once at first call, reused across all requests
_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Returns the shared Redis connection pool.

    Lazy initialization — pool is created on first call, not at import time.
    This avoids connection attempts during module loading (e.g., alembic, tests).
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,  # Returns str instead of bytes — easier to work with
            max_connections=20,
        )
        logger.info("Redis connection pool created | url=%s", settings.redis_url)
    return _redis_client


async def close_redis() -> None:
    """Cleanly shuts down the connection pool. Called during app shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection pool closed")