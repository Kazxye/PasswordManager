import base64
import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.vault import Vault
from ..schemas.vault import VaultCreate,VaultUpdate


logger = logging.getLogger(__name__)

async def _get_vault_with_ownership(
    db: AsyncSession,
    user_id: uuid.UUID,
    vault_id: uuid.UUID,
) -> Vault:
    result = await db.execute(
        select(Vault).where(Vault.id == vault_id, Vault.user_id == user_id)
    )
    vault = result.scalar_one_or_none()

    if not vault:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vault not found",
        )
    return vault

async def create_vault(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: VaultCreate,
) -> Vault:
    vault = Vault(
        user_id=user_id,
        name_encrypted=base64.b64decode(data.name_encrypted),
        name_iv=base64.b64decode(data.name_iv),
    )
    db.add(vault)
    await db.commit()
    await db.refresh(vault)

    logger.info("Vault created: vault=%s user=%s", vault.id, user_id)
    return vault


async def get_user_vaults(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[Vault]:
    result = await db.execute(
        select(Vault)
        .where(Vault.user_id == user_id)
        .order_by(Vault.created_at.desc())
    )
    return list(result.scalars().all())

async def update_vault(
    db: AsyncSession,
    user_id: uuid.UUID,
    vault_id: uuid.UUID,
    data: VaultUpdate,
) -> Vault:
    vault = await _get_vault_with_ownership(db, user_id, vault_id)

    vault.name_encrypted = base64.b64decode(data.name_encrypted)
    vault.name_iv = base64.b64decode(data.name_iv)

    await db.commit()
    await db.refresh(vault)

    logger.info("Vault updated: vault=%s user=%s", vault_id, user_id)
    return vault

async def delete_vault(
    db: AsyncSession,
    user_id: uuid.UUID,
    vault_id: uuid.UUID,
) -> None:
    vault = await _get_vault_with_ownership(db, user_id, vault_id)

    await db.delete(vault)
    await db.commit()

    logger.info("Vault deleted: vault=%s user=%s", vault_id, user_id)