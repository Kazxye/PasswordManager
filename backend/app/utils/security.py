import logging
import secrets
from datetime import datetime, timedelta,timezone

from argon2 import PasswordHasher
from argon2.exceptions import HashingError, VerificationError, VerifyMismatchError
from jose import jwt, JWTError

from ..config import settings

logger = logging.getLogger(__name__)

ph = PasswordHasher(
    time_cost = 2,
    memory_cost = 19000,
    parallelism= 1,
    hash_len=32,
    salt_len=16,
    )

def hash_auth_key(auth_key:str) -> str: # Hash the client-provided auth_key with Argon2id; Returns the full Argon2 encoded string (includes params + salt + hash); This is the value stored in users.auth_key_hash;
    try:
        return ph.hash(auth_key)
    except HashingError:
        logger.error("Auth key is invalid")
        raise

def verify_auth_key(auth_key:str, auth_key_hash:str) -> bool: # Verify auth_key against stored Argon2id hash. Also handles automatic rehashing if Argon2 params changed. Returns True if valid, False if invalid. Raises on other errors.
    try:
        ph.verify(auth_key_hash, auth_key)
        return True
    except VerifyMismatchError:
        return False
    except(VerificationError, HashingError) as e:
        logger.error(f"Argon2id verification failed: {e}")
        raise

def needs_rehash(auth_key_hash:str) -> bool: # Check if stored hash needs rehashing due to updated Argon2 params
    return ph.check_needs_rehash(auth_key_hash)


# --- JWT ---

def create_access_token(user_id: str) -> str: # Create a signed JWT access token with standard claims: sub (user ID), exp (expiration), iat (issued at), jti (unique token ID). Returns the encoded JWT string.
    now = datetime.now(timezone.utc)
    jti = secrets.token_hex(16)

    payload = {
        "sub": user_id,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        "iat": now,
        "jti": jti,
    }

    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    logger.info(f"Access token created for user_id={user_id} | jti={jti}")
    return token

def decode_access_token(token:str) -> dict: # Decode and validate a JWT access token. Verifies signature and expiration. Returns the token payload as a dict if valid, raises JWTError if invalid or expired.
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError as e:
        logger.warning(f"Error decoding access token: {e}")
        raise

# --- Refresh Tokens ---

def generate_refresh_token() -> str: # Generate a secure random string to be used as a refresh token. Returns the token string.
    return secrets.token_hex(64)


