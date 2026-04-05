from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    action: str
    ip_address: str | None
    user_agent: str | None
    metadata: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAuditResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
    page: int
    limit: int