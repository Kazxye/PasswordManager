import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

logger = logging.getLogger(__name__)

# Connection pool sized for single-server deployment
# max_overflow handles burst traffic beyond the base pool_size
engine = create_async_engine(
    settings.database_url,
    echo=settings.is_development,  # Logs SQL queries in dev — disable in prod
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Detects dead connections before handing them out
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevents lazy-load errors in async context
)