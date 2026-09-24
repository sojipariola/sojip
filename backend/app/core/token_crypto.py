"""
Encrypt and decrypt sensitive tokens (GitHub access tokens, etc.).

Uses Fernet (symmetric AES-128 in CBC mode + HMAC authentication).
The key comes from settings.token_encryption_key.
"""
from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


class TokenCryptoError(Exception):
    """Raised when encryption or decryption fails."""


def _fernet() -> Fernet:
    if not settings.token_encryption_key:
        raise TokenCryptoError(
            "TOKEN_ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(settings.token_encryption_key.encode("utf-8"))
    except Exception as e:
        raise TokenCryptoError("Invalid TOKEN_ENCRYPTION_KEY: " + str(e)) from e


def encrypt_token(plaintext: str) -> str:
    """Encrypt a token for storage. Returns a string."""
    f = _fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a stored token. Raises TokenCryptoError on failure."""
    f = _fernet()
    try:
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise TokenCryptoError(
            "Could not decrypt token — the encryption key may have changed."
        ) from e
