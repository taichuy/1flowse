from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from secrets import token_urlsafe
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import WorkflowPublishedApiKey, WorkflowPublishedEndpoint


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _hash_secret_key(secret_key: str) -> str:
    return hashlib.sha256(secret_key.encode("utf-8")).hexdigest()


def _generate_secret_key() -> str:
    return f"sf_pub_{token_urlsafe(24)}"


def _build_key_prefix(secret_key: str) -> str:
    return secret_key[:16]


class PublishedEndpointApiKeyError(ValueError):
    pass


@dataclass(frozen=True)
class PublishedEndpointApiKeySecret:
    record: WorkflowPublishedApiKey
    secret_key: str


class PublishedEndpointApiKeyService:
    def create_key(
        self,
        db: Session,
        *,
        workflow_id: str,
        endpoint_id: str,
        name: str,
    ) -> PublishedEndpointApiKeySecret:
        secret_key = _generate_secret_key()
        record = WorkflowPublishedApiKey(
            id=str(uuid4()),
            workflow_id=workflow_id,
            endpoint_id=endpoint_id,
            name=name.strip(),
            key_prefix=_build_key_prefix(secret_key),
            key_hash=_hash_secret_key(secret_key),
            status="active",
        )
        db.add(record)
        db.flush()
        return PublishedEndpointApiKeySecret(record=record, secret_key=secret_key)

    def list_keys(
        self,
        db: Session,
        *,
        workflow_id: str,
        endpoint_id: str,
        include_revoked: bool = False,
    ) -> list[WorkflowPublishedApiKey]:
        statement = (
            select(WorkflowPublishedApiKey)
            .where(
                WorkflowPublishedApiKey.workflow_id == workflow_id,
                WorkflowPublishedApiKey.endpoint_id == endpoint_id,
            )
            .order_by(
                WorkflowPublishedApiKey.created_at.desc(),
                WorkflowPublishedApiKey.id.desc(),
            )
        )
        if not include_revoked:
            statement = statement.where(WorkflowPublishedApiKey.status == "active")
        return db.scalars(statement).all()

    def revoke_key(
        self,
        db: Session,
        *,
        workflow_id: str,
        endpoint_id: str,
        key_id: str,
    ) -> WorkflowPublishedApiKey:
        record = db.scalar(
            select(WorkflowPublishedApiKey).where(
                WorkflowPublishedApiKey.id == key_id,
                WorkflowPublishedApiKey.workflow_id == workflow_id,
                WorkflowPublishedApiKey.endpoint_id == endpoint_id,
            )
        )
        if record is None:
            raise PublishedEndpointApiKeyError("Published endpoint API key not found.")

        if record.status != "revoked":
            record.status = "revoked"
            record.revoked_at = _utcnow()
            db.add(record)
        return record

    def authenticate_key(
        self,
        db: Session,
        *,
        workflow_id: str,
        endpoint_id: str,
        secret_key: str,
    ) -> WorkflowPublishedApiKey | None:
        normalized_secret = secret_key.strip()
        if not normalized_secret:
            return None

        record = db.scalar(
            select(WorkflowPublishedApiKey).where(
                WorkflowPublishedApiKey.workflow_id == workflow_id,
                WorkflowPublishedApiKey.endpoint_id == endpoint_id,
                WorkflowPublishedApiKey.key_hash == _hash_secret_key(normalized_secret),
                WorkflowPublishedApiKey.status == "active",
            )
        )
        if record is None:
            return None

        record.last_used_at = _utcnow()
        db.add(record)
        return record

    def get_binding_for_api_key_management(
        self,
        db: Session,
        *,
        workflow_id: str,
        binding_id: str,
    ) -> WorkflowPublishedEndpoint:
        binding = db.scalar(
            select(WorkflowPublishedEndpoint).where(
                WorkflowPublishedEndpoint.id == binding_id,
                WorkflowPublishedEndpoint.workflow_id == workflow_id,
            )
        )
        if binding is None:
            raise PublishedEndpointApiKeyError("Published endpoint binding not found.")
        if binding.auth_mode != "api_key":
            raise PublishedEndpointApiKeyError(
                "Published endpoint binding does not use auth mode 'api_key'."
            )
        return binding
