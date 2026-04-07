import logging
import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies.auth import get_current_user
from ..dependencies.database import get_db
from ..models.user import User
from ..schemas.entry import EntryCreate, EntryUpdate, EntryResponse
from ..services import entry_service
from ..services.audit_service import log_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["entries"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host


@router.get("/vaults/{vault_id}/entries", response_model=list[EntryResponse])
async def list_entries(
    vault_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await entry_service.get_vault_entries(db, current_user.id, vault_id)


@router.post("/vaults/{vault_id}/entries", response_model=EntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    request: Request,
    vault_id: uuid.UUID,
    request_data: EntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await entry_service.create_entry(
        db, current_user.id, vault_id,
        request_data.data_encrypted, request_data.data_iv,
    )

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="entry_create",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"entry_id": str(entry.id), "vault_id": str(vault_id)},
    )

    return entry


@router.put("/entries/{entry_id}", response_model=EntryResponse)
async def update_entry(
    request: Request,
    entry_id: uuid.UUID,
    request_data: EntryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await entry_service.update_entry(
        db, current_user.id, entry_id,
        request_data.data_encrypted, request_data.data_iv,
    )

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="entry_update",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"entry_id": str(entry_id)},
    )

    return entry


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    request: Request,
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await entry_service.delete_entry(db, current_user.id, entry_id)

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="entry_delete",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"entry_id": str(entry_id)},
    )