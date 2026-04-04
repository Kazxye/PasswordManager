import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies.auth import get_current_user
from ..dependencies.database import get_db
from ..models.user import User
from ..schemas.auth import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenResponse,
)
from ..services.auth_service import login_user, logout_user, register_user, refresh_session
from ..services.audit_service import log_audit_event
from ..utils.security import decode_access_token, decode_access_token_no_verify_exp
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

COOKIE_NAME = "refresh_token"
COOKIE_MAX_AGE = settings.refresh_token_expire_days * 86400
COOKIE_PATH = "/api/v1/auth"


def _get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For from Nginx."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        path=COOKIE_PATH,
        max_age=COOKIE_MAX_AGE,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=True,
        samesite="strict",
        path=COOKIE_PATH,
    )


@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(
    request: Request,
    request_data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await register_user(request_data.email, request_data.auth_key, db)

    await log_audit_event(
        db=db,
        user_id=user.id,
        action="register",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )

    return MessageResponse(message="created")


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    request_data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await login_user(request_data.email, request_data.auth_key, db)

    await log_audit_event(
        db=db,
        user_id=result["user_id"],
        action="login",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )

    _set_refresh_cookie(response, result["refresh_token"])
    return TokenResponse(access_token=result["access_token"])


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get(COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token missing",
        )

    token = auth_header.replace("Bearer ", "")
    try:
        payload = decode_access_token_no_verify_exp(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token",
        )

    result = await refresh_session(refresh_token, user_id)

    await log_audit_event(
        db=db,
        user_id=user_id,
        action="refresh",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )

    _set_refresh_cookie(response, result["refresh_token"])
    return TokenResponse(access_token=result["access_token"])


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    payload = decode_access_token(token)

    await logout_user(
        user_id=str(current_user.id),
        jti=payload["jti"],
        token_exp=payload["exp"],
    )

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="logout",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )

    _clear_refresh_cookie(response)
    return MessageResponse(message="logged out")