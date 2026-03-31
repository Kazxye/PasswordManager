import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .utils.redis_client import close_redis, get_redis

# Structured logging — timestamp format optimized for log analysis
logging.basicConfig(
    level=logging.DEBUG if settings.is_development else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
logger = logging.getLogger("vaultkeeper")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle.

    Startup: validates external dependencies (Redis) — fail fast if unavailable.
    Shutdown: cleanly releases connection pools.
    """
    logger.info("Starting VaultKeeper API | env=%s", settings.api_env)

    # Fail fast — if Redis is down, the app can't handle auth or rate limiting
    try:
        redis = await get_redis()
        await redis.ping()
        logger.info("Redis connection verified")
    except Exception as e:
        logger.error("Redis connection failed at startup: %s", e)
        raise

    yield

    await close_redis()
    logger.info("VaultKeeper API shutdown complete")


app = FastAPI(
    title="VaultKeeper API",
    version="0.1.0",
    docs_url="/docs" if settings.is_development else None,  # Swagger disabled in prod
    redoc_url=None,
    lifespan=lifespan,
)

# --- CORS ---
# Restricted to frontend origin — no wildcards
# allow_credentials=True is required for HttpOnly cookie (refresh token)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
async def health_check():
    """Liveness probe — confirms API + Redis are reachable."""
    try:
        redis = await get_redis()
        await redis.ping()
        redis_status = "connected"
    except Exception:
        redis_status = "disconnected"

    return {
        "status": "healthy",
        "redis": redis_status,
        "environment": settings.api_env,
    }