import re
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator


def  _validate_base64(value, field_name, min_len = 1, max_len=10240): # Global Reusable base64 check
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
        return _validate_base64(v, "name_encrypted",min_len=1)

    @field_validator("name_iv")
    @classmethod
    def validate_name_iv(cls, v):
        return _validate_base64(v, "name_iv", max_len=64)


class VaultUpdate(BaseModel):
    name_encrypted: str
    name_iv: str

    @field_validator("name_encrypted")
    @classmethod
    def validate_name_encrypted(cls, v):
        return _validate_base64(v, "name_encrypted",min_len=1)

    @field_validator("name_iv")
    @classmethod
    def validate_name_iv(cls, v):
        return _validate_base64(v, "name_iv", max_len=64)


class VaultResponse(BaseModel):
    id: UUID
    name_encrypted: str
    name_iv: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


