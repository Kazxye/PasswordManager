import logging
import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies.auth import get_current_user
from ..dependencies.database import get_db
from ..models.user import User
from ..schemas.vault import VaultCreate, VaultUpdate, VaultResponse
from ..services import vault_service
from ..services.audit_service import log_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/vaults", tags=["vaults"])
def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host


@router.get("/", response_model=list[VaultResponse])
async def list_vaults(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await vault_service.get_user_vaults(db, current_user.id)


@router.post("/", response_model=VaultResponse, status_code=status.HTTP_201_CREATED)
async def create_vault(
    request: Request,
    request_data: VaultCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vault = await vault_service.create_vault(db, current_user.id, request_data)

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="vault_create",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"vault_id": str(vault.id)},
    )

    return vault


@router.put("/{vault_id}", response_model=VaultResponse)
async def update_vault(
    request: Request,
    vault_id: uuid.UUID,
    request_data: VaultUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vault = await vault_service.update_vault(db, current_user.id, vault_id, request_data)

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="vault_update",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"vault_id": str(vault.id)},
    )

    return vault


@router.delete("/{vault_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault(
    request: Request,
    vault_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await vault_service.delete_vault(db, current_user.id, vault_id)

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="vault_delete",
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"vault_id": str(vault_id)},
    )