import re
import base64
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, field_validator
from .validators import validate_base64


class EntryCreate(BaseModel):
    data_encrypted: str
    data_iv: str

    @field_validator("data_encrypted")
    @classmethod
    def validate_data_encrypted(cls, v):
        return validate_base64(v, "data_encrypted")

    @field_validator("data_iv")
    @classmethod
    def validate_data_iv(cls, v):
        if v != v.strip():
            raise ValueError("data_iv must not contain whitespace")
        if len(v) != 16:
            raise ValueError("data_iv must be exactly 16 characters long")
        if not re.match(r"^[A-Za-z0-9+/=]+$", v):
            raise ValueError("data_iv must be a valid base64")
        return v


class EntryUpdate(BaseModel):
    data_encrypted: str
    data_iv: str

    @field_validator("data_encrypted")
    @classmethod
    def validate_data_encrypted(cls, v):
        return validate_base64(v, "data_encrypted")

    @field_validator("data_iv")
    @classmethod
    def validate_data_iv(cls, v):
        if v != v.strip():
            raise ValueError("data_iv must not contain whitespace")
        if len(v) != 16:
            raise ValueError("data_iv must be exactly 16 characters long")
        if not re.match(r"^[A-Za-z0-9+/=]+$", v):
            raise ValueError("data_iv must be a valid base64")
        return v


class EntryResponse(BaseModel):
    id: UUID
    vault_id: UUID
    data_encrypted: str
    data_iv: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("data_encrypted", "data_iv", mode="before")
    @classmethod
    def bytes_to_base64(cls, v):
        if isinstance(v, bytes):
            return base64.b64encode(v).decode("ascii")
        return v