"""SDE2 encrypted multi-DEX payload container.

This module is the format core only. It does not rewrite APKs or claim a
protected APK is launchable; the Android shell/manifest integration is a
separate milestone.
"""
from __future__ import annotations

import os
import struct
from typing import Iterable

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"SDE2"
VERSION = 1
NONCE_SIZE = 12
KEY_SIZE = 32
TAG_SIZE = 16
MAX_DEX_COUNT = 64
MAX_TOTAL_SIZE = 512 * 1024 * 1024
_HEADER = struct.Struct(">4sB12s")
_U32 = struct.Struct(">I")
_U64 = struct.Struct(">Q")


class PayloadError(ValueError):
    """Invalid or unauthentic SDE2 payload."""


def _validate_dex(blob: bytes) -> None:
    if not isinstance(blob, bytes) or len(blob) < 112:
        raise PayloadError("DEX payload is empty or too small")
    if blob[:4] != b"dex\n" or blob[7:8] != b"\0":
        raise PayloadError("Payload item is not a standard DEX file")
    declared = struct.unpack_from("<I", blob, 32)[0]
    if declared != len(blob):
        raise PayloadError("DEX file_size does not match its byte length")


def _serialize(dex_files: Iterable[bytes]) -> bytes:
    items = list(dex_files)
    if not items or len(items) > MAX_DEX_COUNT:
        raise PayloadError(f"DEX count must be between 1 and {MAX_DEX_COUNT}")
    total = 0
    out = bytearray(_U32.pack(len(items)))
    for dex in items:
        _validate_dex(dex)
        total += len(dex)
        if total > MAX_TOTAL_SIZE:
            raise PayloadError("Combined DEX payload exceeds the size limit")
        out.extend(_U64.pack(len(dex)))
        out.extend(dex)
    return bytes(out)


def pack_payload(dex_files: Iterable[bytes], key: bytes, nonce: bytes | None = None) -> bytes:
    """Encrypt DEX buffers into one opaque container; key is supplied by caller."""
    if not isinstance(key, bytes) or len(key) != KEY_SIZE:
        raise PayloadError("AES-256 key must be exactly 32 bytes")
    nonce = os.urandom(NONCE_SIZE) if nonce is None else nonce
    if not isinstance(nonce, bytes) or len(nonce) != NONCE_SIZE:
        raise PayloadError("GCM nonce must be exactly 12 bytes")
    header = _HEADER.pack(MAGIC, VERSION, nonce)
    ciphertext = AESGCM(key).encrypt(nonce, _serialize(dex_files), header)
    return header + ciphertext


def unpack_payload(container: bytes, key: bytes) -> tuple[bytes, ...]:
    """Authenticate and decode a container into DEX buffers in original order."""
    if not isinstance(key, bytes) or len(key) != KEY_SIZE:
        raise PayloadError("AES-256 key must be exactly 32 bytes")
    if not isinstance(container, bytes) or len(container) < _HEADER.size + TAG_SIZE + 4:
        raise PayloadError("Encrypted payload is truncated")
    magic, version, nonce = _HEADER.unpack_from(container)
    if magic != MAGIC or version != VERSION:
        raise PayloadError("Unsupported encrypted payload format")
    header = container[:_HEADER.size]
    try:
        plain = AESGCM(key).decrypt(nonce, container[_HEADER.size:], header)
    except Exception as exc:
        raise PayloadError("Payload authentication failed") from exc

    if len(plain) < 4:
        raise PayloadError("Payload index is truncated")
    count = _U32.unpack_from(plain)[0]
    if count < 1 or count > MAX_DEX_COUNT:
        raise PayloadError("Invalid DEX count")
    offset = 4
    result: list[bytes] = []
    total = 0
    for _ in range(count):
        if offset + 8 > len(plain):
            raise PayloadError("Payload entry header is truncated")
        size = _U64.unpack_from(plain, offset)[0]
        offset += 8
        if size < 112 or size > MAX_TOTAL_SIZE or offset + size > len(plain):
            raise PayloadError("Invalid DEX entry size")
        blob = plain[offset:offset + size]
        offset += size
        _validate_dex(blob)
        total += size
        if total > MAX_TOTAL_SIZE:
            raise PayloadError("Combined DEX payload exceeds the size limit")
        result.append(blob)
    if offset != len(plain):
        raise PayloadError("Unexpected trailing payload data")
    return tuple(result)
