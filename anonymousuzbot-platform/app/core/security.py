from base64 import urlsafe_b64decode
from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet() -> Fernet:
    key = settings.telegram_id_encryption_key.encode("utf-8")
    if len(key) != 44:
        raise ValueError("TELEGRAM_ID_ENCRYPTION_KEY must be a valid Fernet base64 key")
    urlsafe_b64decode(key)
    return Fernet(key)


def encrypt_telegram_id(telegram_id: int) -> str:
    return _fernet().encrypt(str(telegram_id).encode("utf-8")).decode("utf-8")


def decrypt_telegram_id(ciphertext: str) -> int:
    raw = _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    return int(raw)
