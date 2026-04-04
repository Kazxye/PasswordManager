import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.user import User
from ..utils.redis_client import redis_client
from ..utils.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_auth_key,
    needs_rehash,
    verify_auth_key,
)

logger = logging.getLogger(__name__)

# Redis key prefixes — centralized to avoid typos across the codebase
REFRESH_PREFIX = "refresh:"      # refresh:<user_id> → token
BLACKLIST_PREFIX = "blacklist:"  # blacklist:<jti> → "1"

REFRESH_TTL = settings.refresh_token_expire_days * 86400  # days → seconds


async def register_user(email: str, auth_key: str, db: AsyncSession) -> User:
    """Create a new user account.

    Steps:
      1. Check email uniqueness
      2. Hash auth_key with Argon2id (server-side, defense in depth)
      3. Insert user into DB
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        # Intentionally vague — don't reveal whether email exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed",
        )

    # Hash auth_key — second layer of Argon2id on top of client-side derivation
    auth_key_hash = hash_auth_key(auth_key)

    user = User(email=email, auth_key_hash=auth_key_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("User registered: %s", user.id)
    return user


async def login_user(
    email: str, auth_key: str, db: AsyncSession
) -> dict:
    """Authenticate user and issue tokens.

    Steps:
      1. Find user by email
      2. Verify auth_key against stored hash
      3. Rehash if Argon2 params changed
      4. Generate access token (JWT) + refresh token (opaque)
      5. Store refresh token in Redis with TTL
    Returns dict with access_token and refresh_token.
    """
    # Find user — constant-time-ish: don't short-circuit on missing email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        # Hash a dummy value to prevent timing attacks
        # Without this, "user not found" returns faster than "wrong password"
        hash_auth_key("dummy_value_for_timing_consistency")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Verify auth_key against stored Argon2id hash
    if not verify_auth_key(auth_key, user.auth_key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Transparent rehash if server-side Argon2 params were updated
    if needs_rehash(user.auth_key_hash):
        user.auth_key_hash = hash_auth_key(auth_key)
        await db.commit()
        logger.info("Rehashed auth_key for user=%s", user.id)

    # Generate tokens
    user_id_str = str(user.id)
    access_token = create_access_token(user_id_str)
    refresh_token = generate_refresh_token()

    # Store refresh token in Redis — one active session per user
    await redis_client.set(
        f"{REFRESH_PREFIX}{user_id_str}",
        refresh_token,
        ex=REFRESH_TTL,
    )

    logger.info("User logged in: %s", user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": user_id_str,
    }


async def refresh_session(refresh_token: str, user_id: str) -> dict:
    """Rotate refresh token and issue new access token.

    Steps:
      1. Validate refresh token against Redis
      2. Delete old refresh token (rotation)
      3. Generate new access + refresh tokens
      4. Store new refresh token in Redis
    """
    redis_key = f"{REFRESH_PREFIX}{user_id}"

    # Validate — compare against stored token
    stored_token = await redis_client.get(redis_key)

    if not stored_token or stored_token != refresh_token:
        # Token mismatch could mean replay attack or stolen token
        # Revoke everything for this user as a precaution
        await redis_client.delete(redis_key)
        logger.warning(
            "Refresh token mismatch for user=%s — possible replay attack", user_id
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Rotation: delete old, generate new
    await redis_client.delete(redis_key)

    new_access_token = create_access_token(user_id)
    new_refresh_token = generate_refresh_token()

    await redis_client.set(
        redis_key,
        new_refresh_token,
        ex=REFRESH_TTL,
    )

    logger.info("Session refreshed for user=%s", user_id)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
    }


async def logout_user(user_id: str, jti: str, token_exp: int) -> None:
    """Revoke all tokens for a user session.

    Steps:
      1. Delete refresh token from Redis
      2. Blacklist current JWT (by jti) with TTL = remaining lifetime
    """
    # Revoke refresh token
    await redis_client.delete(f"{REFRESH_PREFIX}{user_id}")

    # Blacklist JWT — TTL ensures it auto-cleans after the JWT would have expired
    import time
    remaining = token_exp - int(time.time())
    if remaining > 0:
        await redis_client.set(
            f"{BLACKLIST_PREFIX}{jti}",
            "1",
            ex=remaining,
        )

    logger.info("User logged out: %s | jti blacklisted: %s", user_id, jti)