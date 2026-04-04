import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit_log import AuditLog

logger = logging.getLogger(__name__)


async def log_audit_event( # Write an immutable audit log entry, Called after auth events (register, login, logout, refresh, failed attempts).
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_=metadata or {},
    )
    db.add(entry)
    await db.commit()

    logger.info(
        "Audit: action=%s user=%s ip=%s",
        action, user_id, ip_address,
    )