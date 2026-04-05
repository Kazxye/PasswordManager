import re
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator


def  validate_base64(value, field_name, min_len = 1, max_len=10240): # Global Reusable base64 check
    if len(value) < min_len:
        raise ValueError(f"'{field_name}' is too short")
    if len(value) > max_len:
        raise ValueError(f"'{field_name}' is too long")
    if not re.match(r"^[A-Za-z0-9+/=]+$", value):
        raise ValueError(f"'{field_name}' is invalid")
    return value


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