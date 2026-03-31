import uuid

from sqlalchemy import ForeignKey, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Entry(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "entries"

    vault_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaults.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Entire entry encrypted as single JSON blob: {site, username, password, notes}
    # Server has zero knowledge of contents, field count, or structure
    data_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    data_iv: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # 12 bytes (96-bit nonce)

    # Relationships
    vault = relationship("Vault", back_populates="entries")
