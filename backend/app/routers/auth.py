import logging

from fastapi import APIRouter, Depends, Request, Response
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
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Cookie config — centralized to avoid inconsistencies
COOKIE_NAME = "refresh_token"
COOKIE_MAX_AGE = settings.refresh_token_expire_days * 86400
COOKIE_PATH = "/api/v1/auth"  # Cookie only sent to auth endpoints


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set refresh token as HttpOnly cookie with security flags."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=refresh_token,
        httponly=True,      # JavaScript cannot read it — immune to XSS
        secure=True,        # Only sent over HTTPS
        samesite="strict",  # Not sent on cross-origin requests — CSRF protection
        path=COOKIE_PATH,   # Scoped to auth endpoints only
        max_age=COOKIE_MAX_AGE,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Remove refresh token cookie from the browser."""
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=True,
        samesite="strict",
        path=COOKIE_PATH,
    )


@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(
    request_data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    await register_user(request_data.email, request_data.auth_key, db)
    return MessageResponse(message="created")


@router.post("/login", response_model=TokenResponse)
async def login(
    request_data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await login_user(request_data.email, request_data.auth_key, db)

    # Refresh token goes in cookie, NOT in response body
    _set_refresh_cookie(response, result["refresh_token"])

    # Access token goes in response body
    return TokenResponse(access_token=result["access_token"])


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
):
    # Refresh token comes from the cookie
    refresh_token = request.cookies.get(COOKIE_NAME)
    if not refresh_token:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    # Extract user_id from JWT — even if expired, signature is still validated
    from ..utils.security import decode_access_token_no_verify_exp
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token missing",
        )

    token = auth_header.replace("Bearer ", "")
    try:
        payload = decode_access_token_no_verify_exp(token)
    except Exception:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    user_id = payload.get("sub")
    if not user_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token",
        )

    result = await refresh_session(refresh_token, user_id)

    _set_refresh_cookie(response, result["refresh_token"])
    return TokenResponse(access_token=result["access_token"])


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    # Extract jti and exp from the current JWT for blacklisting
    from ..utils.security import decode_access_token
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    payload = decode_access_token(token)

    await logout_user(
        user_id=str(current_user.id),
        jti=payload["jti"],
        token_exp=payload["exp"],
    )

    # Clear the cookie from the browser
    _clear_refresh_cookie(response)

    return MessageResponse(message="logged out")