import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies.auth import get_current_user
from ..dependencies.database import get_db
from ..models.audit_log import AuditLog
from ..models.user import User
from ..schemas.audit import AuditLogResponse, PaginatedAuditResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/logs", response_model=PaginatedAuditResponse)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    action: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated audit logs for the authenticated user.

    Users can only see their own logs — no cross-user access.
    Optional filter by action type (login, logout, vault_create, etc.)
    """
    # Base query — scoped to current user
    base_filter = AuditLog.user_id == current_user.id
    if action:
        base_filter = (AuditLog.user_id == current_user.id) & (AuditLog.action == action)

    # Total count for pagination metadata
    count_result = await db.execute(
        select(func.count()).select_from(AuditLog).where(base_filter)
    )
    total = count_result.scalar()

    # Fetch page
    offset = (page - 1) * limit
    result = await db.execute(
        select(AuditLog)
        .where(base_filter)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    logs = list(result.scalars().all())

    return PaginatedAuditResponse(
        logs=logs,
        total=total,
        page=page,
        limit=limit,
    )