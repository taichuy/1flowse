from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.credential import (
    CredentialCreateRequest,
    CredentialDetail,
    CredentialItem,
    CredentialUpdateRequest,
)
from app.services.credential_encryption import CredentialEncryptionError
from app.services.credential_store import CredentialStore, CredentialStoreError

router = APIRouter(prefix="/credentials", tags=["credentials"])
credential_store = CredentialStore()


def _serialize_item(record) -> CredentialItem:
    return CredentialItem(
        id=record.id,
        name=record.name,
        credential_type=record.credential_type,
        description=record.description,
        status=record.status,
        last_used_at=record.last_used_at,
        revoked_at=record.revoked_at,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _serialize_detail(record, data_keys: list[str]) -> CredentialDetail:
    return CredentialDetail(
        **_serialize_item(record).model_dump(),
        data_keys=data_keys,
    )


def _raise_credential_error(
    exc: CredentialStoreError | CredentialEncryptionError,
) -> None:
    detail = str(exc)
    if "not found" in detail.lower():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=detail
        ) from exc
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail
    ) from exc


@router.get("", response_model=list[CredentialItem])
def list_credentials(
    include_revoked: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CredentialItem]:
    items = credential_store.list_credentials(db, include_revoked=include_revoked)
    return [_serialize_item(item) for item in items]


@router.post("", response_model=CredentialDetail, status_code=status.HTTP_201_CREATED)
def create_credential(
    payload: CredentialCreateRequest,
    db: Session = Depends(get_db),
) -> CredentialDetail:
    try:
        record = credential_store.create(
            db,
            name=payload.name,
            credential_type=payload.credential_type,
            data=payload.data,
            description=payload.description,
        )
    except (CredentialStoreError, CredentialEncryptionError) as exc:
        _raise_credential_error(exc)
    db.commit()
    db.refresh(record)
    data_keys = credential_store.get_data_keys(record)
    return _serialize_detail(record, data_keys)


@router.get("/{credential_id}", response_model=CredentialDetail)
def get_credential(
    credential_id: str,
    db: Session = Depends(get_db),
) -> CredentialDetail:
    try:
        record = credential_store.get(db, credential_id=credential_id)
    except CredentialStoreError as exc:
        _raise_credential_error(exc)
    data_keys = credential_store.get_data_keys(record)
    return _serialize_detail(record, data_keys)


@router.put("/{credential_id}", response_model=CredentialDetail)
def update_credential(
    credential_id: str,
    payload: CredentialUpdateRequest,
    db: Session = Depends(get_db),
) -> CredentialDetail:
    try:
        record = credential_store.update(
            db,
            credential_id=credential_id,
            name=payload.name,
            data=payload.data,
            description=payload.description,
        )
    except (CredentialStoreError, CredentialEncryptionError) as exc:
        _raise_credential_error(exc)
    db.commit()
    db.refresh(record)
    data_keys = credential_store.get_data_keys(record)
    return _serialize_detail(record, data_keys)


@router.delete("/{credential_id}", response_model=CredentialItem)
def revoke_credential(
    credential_id: str,
    db: Session = Depends(get_db),
) -> CredentialItem:
    try:
        record = credential_store.revoke(db, credential_id=credential_id)
    except CredentialStoreError as exc:
        _raise_credential_error(exc)
    db.commit()
    db.refresh(record)
    return _serialize_item(record)
