import uuid

from sqlalchemy import ForeignKey, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Vault(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "vaults"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Vault name encrypted with AES-256-GCM on the client
    # Server never sees plaintext — zero knowledge
    name_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    name_iv: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # 12 bytes (96-bit nonce)

    # Relationships
    user = relationship("User", back_populates="vaults")
    entries = relationship(
        "Entry", back_populates="vault", cascade="all, delete-orphan"
    )
