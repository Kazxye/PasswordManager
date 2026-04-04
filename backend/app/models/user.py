from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    # Argon2id hash of auth_key (which is already derived from master_password)
    # Defense in depth: even if DB leaks, attacker needs to crack this hash,
    # then reverse the client-side Argon2id — two layers
    auth_key_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships — CASCADE ensures deleting user removes everything
    vaults = relationship("Vault", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship(
        "AuditLog", back_populates="user", cascade="all, delete-orphan"
    )
