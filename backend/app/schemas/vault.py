import re
import base64
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, field_validator
from .validators import validate_base64


class VaultCreate(BaseModel):
    name_encrypted: str
    name_iv: str

    @field_validator("name_encrypted")
    @classmethod
    def validate_name_encrypted(cls, v):
        return validate_base64(v, "name_encrypted")

    @field_validator("name_iv")
    @classmethod
    def validate_name_iv(cls, v):
        if v != v.strip():
            raise ValueError("name_iv must not contain whitespace")
        if len(v) != 16:
            raise ValueError("name_iv must be exactly 16 characters long")
        if not re.match(r"^[A-Za-z0-9+/=]+$", v):
            raise ValueError("name_iv must be a valid base64")
        return v


class VaultUpdate(BaseModel):
    name_encrypted: str
    name_iv: str

    @field_validator("name_encrypted")
    @classmethod
    def validate_name_encrypted(cls, v):
        return validate_base64(v, "name_encrypted")

    @field_validator("name_iv")
    @classmethod
    def validate_name_iv(cls, v):
        if v != v.strip():
            raise ValueError("name_iv must not contain whitespace")
        if len(v) != 16:
            raise ValueError("name_iv must be exactly 16 characters long")
        if not re.match(r"^[A-Za-z0-9+/=]+$", v):
            raise ValueError("name_iv must be a valid base64")
        return v


class VaultResponse(BaseModel):
    id: UUID
    name_encrypted: str
    name_iv: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("name_encrypted", "name_iv", mode="before")
    @classmethod
    def bytes_to_base64(cls, v):
        # SQLAlchemy returns bytes (LargeBinary), API returns base64 strings
        if isinstance(v, bytes):
            return base64.b64encode(v).decode("ascii")
        return v