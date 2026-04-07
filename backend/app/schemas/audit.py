from datetime import datetime
from ipaddress import IPv4Address, IPv6Address
from uuid import UUID

from pydantic import BaseModel, Field


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    action: str
    ip_address: IPv4Address | IPv6Address | None
    user_agent: str | None
    metadata: dict | None = Field(validation_alias="metadata_")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class PaginatedAuditResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
    page: int
    limit: int