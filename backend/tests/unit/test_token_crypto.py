"""Unit tests for app.core.token_crypto."""
import pytest
from cryptography.fernet import Fernet

from app.core import token_crypto

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def _set_key(monkeypatch):
    """Give the crypto module a stable key for the duration of the test."""
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(
        token_crypto.settings, "token_encryption_key", key, raising=False,
    )
    yield


def test_encrypt_decrypt_roundtrip():
    secret = "ghp_testtoken123"
    cipher = token_crypto.encrypt_token(secret)
    assert cipher != secret
    assert token_crypto.decrypt_token(cipher) == secret


def test_ciphertext_is_not_plaintext():
    secret = "hello-world"
    cipher = token_crypto.encrypt_token(secret)
    assert secret not in cipher


def test_different_calls_produce_different_ciphertexts():
    secret = "same-input"
    c1 = token_crypto.encrypt_token(secret)
    c2 = token_crypto.encrypt_token(secret)
    # Fernet includes a random IV so ciphertexts differ
    assert c1 != c2
    # Both decrypt to the same plaintext
    assert token_crypto.decrypt_token(c1) == secret
    assert token_crypto.decrypt_token(c2) == secret


def test_decrypt_with_wrong_key_raises(monkeypatch):
    cipher = token_crypto.encrypt_token("secret")
    # Swap the key
    monkeypatch.setattr(
        token_crypto.settings,
        "token_encryption_key",
        Fernet.generate_key().decode(),
        raising=False,
    )
    with pytest.raises(token_crypto.TokenCryptoError):
        token_crypto.decrypt_token(cipher)


def test_missing_key_raises(monkeypatch):
    monkeypatch.setattr(
        token_crypto.settings, "token_encryption_key", "", raising=False,
    )
    with pytest.raises(token_crypto.TokenCryptoError):
        token_crypto.encrypt_token("x")
