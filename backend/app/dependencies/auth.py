import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies.database import get_db
from ..models.user import User
from ..utils.redis_client import redis_client
from ..utils.security import decode_access_token

logger = logging.getLogger(__name__)

# Extracts "Bearer <token>" from Authorization header automatically
# auto_error=True returns 401 if header is missing
security_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate JWT from Authorization header, check blacklist, return User.

    Pipeline:
      1. Extract token from Bearer header
      2. Decode + verify signature + check expiration
      3. Check if token was revoked (jti in Redis blacklist)
      4. Load user from DB
      5. Return User object for use in route handlers
    """
    token = credentials.credentials

    # Step 1: Decode JWT — checks signature and expiration
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    jti = payload.get("jti")

    if not user_id or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload",
        )

    # Step 2: Check blacklist — logout adds jti to Redis
    blacklisted = await redis_client.get(f"blacklist:{jti}")
    if blacklisted:
        logger.warning("Blacklisted JWT used: jti=%s user=%s", jti, user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    # Step 3: Load user from DB
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning("JWT references non-existent user: %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user