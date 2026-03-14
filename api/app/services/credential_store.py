from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.credential import Credential
from app.services.credential_encryption import (
    CredentialEncryptionError,
    CredentialEncryptionService,
)


class CredentialStoreError(ValueError):
    """Raised for credential store domain errors."""


class CredentialStore:
    def __init__(
        self, *, encryption: CredentialEncryptionService | None = None
    ) -> None:
        self._encryption = encryption or CredentialEncryptionService()

    def create(
        self,
        db: Session,
        *,
        name: str,
        credential_type: str,
        data: dict[str, str],
        description: str = "",
    ) -> Credential:
        encrypted = self._encryption.encrypt(data)
        record = Credential(
            id=str(uuid4()),
            name=name.strip(),
            credential_type=credential_type.strip(),
            encrypted_data=encrypted,
            description=description.strip(),
            status="active",
        )
        db.add(record)
        db.flush()
        return record

    def list_credentials(
        self, db: Session, *, include_revoked: bool = False
    ) -> list[Credential]:
        stmt = select(Credential).order_by(Credential.created_at.desc())
        if not include_revoked:
            stmt = stmt.where(Credential.status == "active")
        return list(db.scalars(stmt).all())

    def get(self, db: Session, *, credential_id: str) -> Credential:
        record = db.get(Credential, credential_id)
        if record is None:
            raise CredentialStoreError("Credential not found.")
        return record

    def update(
        self,
        db: Session,
        *,
        credential_id: str,
        name: str | None = None,
        data: dict[str, str] | None = None,
        description: str | None = None,
    ) -> Credential:
        record = self.get(db, credential_id=credential_id)
        if record.status == "revoked":
            raise CredentialStoreError("Cannot update a revoked credential.")
        if name is not None:
            record.name = name.strip()
        if description is not None:
            record.description = description.strip()
        if data is not None:
            record.encrypted_data = self._encryption.encrypt(data)
        db.add(record)
        db.flush()
        return record

    def revoke(self, db: Session, *, credential_id: str) -> Credential:
        record = self.get(db, credential_id=credential_id)
        if record.status != "revoked":
            record.status = "revoked"
            record.revoked_at = datetime.now(UTC)
            db.add(record)
        return record

    def decrypt_data(self, db: Session, *, credential_id: str) -> dict[str, str]:
        """Decrypt and return credential data. For runtime use only."""
        record = self.get(db, credential_id=credential_id)
        if record.status == "revoked":
            raise CredentialStoreError("Cannot decrypt a revoked credential.")
        result = self._encryption.decrypt(record.encrypted_data)
        record.last_used_at = datetime.now(UTC)
        db.add(record)
        db.flush()
        return result

    def get_data_keys(self, record: Credential) -> list[str]:
        """Return field names in the encrypted data without exposing values."""
        try:
            data = self._encryption.decrypt(record.encrypted_data)
            return sorted(data.keys())
        except CredentialEncryptionError:
            return []

    def resolve_credential_refs(
        self, db: Session, *, credentials: dict[str, str]
    ) -> dict[str, str]:
        """Resolve credential://{id} references in a credentials dict.

        For each value matching 'credential://<id>', decrypt and merge.
        Plain string values pass through unchanged.
        """
        resolved: dict[str, str] = {}
        for key, value in credentials.items():
            if isinstance(value, str) and value.startswith("credential://"):
                cred_id = value.removeprefix("credential://").strip()
                if not cred_id:
                    raise CredentialStoreError(
                        f"Credential reference for key '{key}' has an empty ID."
                    )
                decrypted = self.decrypt_data(db, credential_id=cred_id)
                resolved.update(decrypted)
            else:
                resolved[key] = str(value)
        return resolved
