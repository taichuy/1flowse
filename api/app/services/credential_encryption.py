from __future__ import annotations

import json

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


class CredentialEncryptionError(ValueError):
    """Raised when credential encryption or decryption fails."""


class CredentialEncryptionService:
    """Encrypts and decrypts credential data using Fernet (AES-128-CBC + HMAC-SHA256).

    The encryption key is loaded from SEVENFLOWS_CREDENTIAL_ENCRYPTION_KEY.
    It must be a valid Fernet key (32 bytes, base64-encoded = 44 chars).
    Generate one with:
        python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    """

    def _get_fernet(self) -> Fernet:
        key = get_settings().credential_encryption_key
        if not key:
            raise CredentialEncryptionError(
                "SEVENFLOWS_CREDENTIAL_ENCRYPTION_KEY is not configured. "
                'Generate one with: python -c "from cryptography.fernet import Fernet; '
                'print(Fernet.generate_key().decode())"'
            )
        try:
            return Fernet(key.encode("utf-8"))
        except Exception as exc:
            raise CredentialEncryptionError(
                "SEVENFLOWS_CREDENTIAL_ENCRYPTION_KEY is not a valid Fernet key."
            ) from exc

    def encrypt(self, plain_data: dict[str, str]) -> str:
        """Encrypt a dict of credential key-value pairs. Returns a Fernet token string."""
        fernet = self._get_fernet()
        serialized = json.dumps(plain_data, ensure_ascii=False, sort_keys=True)
        return fernet.encrypt(serialized.encode("utf-8")).decode("utf-8")

    def decrypt(self, encrypted_data: str) -> dict[str, str]:
        """Decrypt a Fernet token back to credential key-value pairs."""
        fernet = self._get_fernet()
        try:
            decrypted_bytes = fernet.decrypt(encrypted_data.encode("utf-8"))
        except InvalidToken as exc:
            raise CredentialEncryptionError(
                "Failed to decrypt credential data. The encryption key may have changed."
            ) from exc
        return json.loads(decrypted_bytes.decode("utf-8"))
