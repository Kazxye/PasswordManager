import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base, UUIDPrimaryKeyMixin


class AuditLog(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Action type: login, logout, vault_access, entry_create, entry_delete, etc.
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # IP and user agent — essential for detecting anomalous access patterns
    ip_address = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Flexible metadata: vault_id, entry_id, failure reason, geo info, etc.
    # JSONB allows indexed queries on metadata fields if needed later
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default="{}", nullable=False
    )

    # No updated_at — audit logs are immutable (write-once)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,  # Indexed for time-range queries in audit dashboard
    )

    # Relationships
    user = relationship("User", back_populates="audit_logs")
