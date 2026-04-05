import base64
import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entry import Entry
from ..models.vault import Vault

logger = logging.getLogger(__name__)


async def _verify_vault_ownership(
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


async def create_entry(
    db: AsyncSession,
    user_id: uuid.UUID,
    vault_id: uuid.UUID,
    data_encrypted: str,
    data_iv: str,
) -> Entry:
    await _verify_vault_ownership(db, user_id, vault_id)

    entry = Entry(
        vault_id=vault_id,
        data_encrypted=base64.b64decode(data_encrypted),
        data_iv=base64.b64decode(data_iv),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    logger.info("Entry created: entry=%s vault=%s user=%s", entry.id, vault_id, user_id)
    return entry


async def get_vault_entries(
    db: AsyncSession,
    user_id: uuid.UUID,
    vault_id: uuid.UUID,
) -> list[Entry]:
    await _verify_vault_ownership(db, user_id, vault_id)

    result = await db.execute(
        select(Entry)
        .where(Entry.vault_id == vault_id)
        .order_by(Entry.created_at.desc())
    )
    return list(result.scalars().all())


async def _get_entry_with_ownership(
    db: AsyncSession,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
) -> Entry:
    result = await db.execute(
        select(Entry)
        .join(Vault, Entry.vault_id == Vault.id)
        .where(Entry.id == entry_id, Vault.user_id == user_id)
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entry not found",
        )
    return entry


async def update_entry(
    db: AsyncSession,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    data_encrypted: str,
    data_iv: str,
) -> Entry:
    entry = await _get_entry_with_ownership(db, user_id, entry_id)

    entry.data_encrypted = base64.b64decode(data_encrypted)
    entry.data_iv = base64.b64decode(data_iv)

    await db.commit()
    await db.refresh(entry)

    logger.info("Entry updated: entry=%s user=%s", entry_id, user_id)
    return entry


async def delete_entry(
    db: AsyncSession,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
) -> None:
    entry = await _get_entry_with_ownership(db, user_id, entry_id)

    await db.delete(entry)
    await db.commit()

    logger.info("Entry deleted: entry=%s user=%s", entry_id, user_id)