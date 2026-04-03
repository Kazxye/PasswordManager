import re

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    auth_key: str  # base64-encoded, derived client-side via Argon2id + HKDF

    @field_validator("auth_key")
    @classmethod
    def validate_auth_key(cls, v):
        # auth_key is HKDF output (256 bits) → base64 = 44 chars
        # Reject obviously wrong values before hitting Argon2id
        if len(v) < 20:
            raise ValueError("auth_key too short")
        if len(v) > 128:
            raise ValueError("auth_key too long")
        # Validate base64 charset
        if not re.match(r"^[A-Za-z0-9+/=]+$", v):
            raise ValueError("auth_key must be valid base64")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    auth_key: str

    @field_validator("auth_key")
    @classmethod
    def validate_auth_key(cls, v):
        if len(v) < 20:
            raise ValueError("auth_key too short")
        if len(v) > 128:
            raise ValueError("auth_key too long")
        if not re.match(r"^[A-Za-z0-9+/=]+$", v):
            raise ValueError("auth_key must be valid base64")
        return v


class TokenResponse(BaseModel):
    access_token: str


class MessageResponse(BaseModel):
    message: str