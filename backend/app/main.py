import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .middleware.rate_limiter import RateLimitMiddleware
from .middleware.request_id import RequestIDMiddleware
from .routers.auth import router as auth_router
from .routers.vaults import router as vaults_router
from .routers.entries import router as entries_router
from .routers.audit import router as audit_router
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
    docs_url="/docs" if settings.is_development else None,
    redoc_url=None,
    lifespan=lifespan,
)

# --- Middleware ---
# Order matters: first added = outermost (executes first on request, last on response)
# RequestID first so every request (including rate-limited ones) gets an ID
app.add_middleware(RequestIDMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS must be outermost to handle preflight OPTIONS requests before anything else
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Routers ---
app.include_router(auth_router)
app.include_router(vaults_router)
app.include_router(entries_router)
app.include_router(audit_router)


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