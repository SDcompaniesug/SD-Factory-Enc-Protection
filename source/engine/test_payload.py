import struct
import unittest

from payload import PayloadError, pack_payload, unpack_payload


def fake_dex(seed: int, size: int = 160) -> bytes:
    data = bytearray((seed + i) & 0xFF for i in range(size))
    data[:8] = b"dex\n039\0"
    struct.pack_into("<I", data, 32, size)
    return bytes(data)


class PayloadTests(unittest.TestCase):
    def setUp(self):
        self.key = bytes(range(32))
        self.dexes = (fake_dex(1), fake_dex(2, 192))

    def test_round_trip_keeps_multiple_dex_buffers_in_order(self):
        packed = pack_payload(self.dexes, self.key, bytes(range(12)))
        self.assertEqual(unpack_payload(packed, self.key), self.dexes)
        self.assertNotIn(self.dexes[0], packed)
        self.assertNotIn(self.dexes[1], packed)

    def test_wrong_key_fails_authentication(self):
        packed = pack_payload(self.dexes, self.key, bytes(range(12)))
        with self.assertRaises(PayloadError):
            unpack_payload(packed, b"x" * 32)

    def test_tampering_fails_authentication(self):
        packed = bytearray(pack_payload(self.dexes, self.key, bytes(range(12))))
        packed[-1] ^= 1
        with self.assertRaises(PayloadError):
            unpack_payload(bytes(packed), self.key)

    def test_rejects_bad_dex(self):
        with self.assertRaises(PayloadError):
            pack_payload((b"not dex",), self.key)

    def test_rejects_trailing_plaintext_via_authenticated_fixture(self):
        # The decoder rejects malformed lengths/structure after successful AEAD.
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import payload as module
        nonce = bytes(range(12))
        header = module._HEADER.pack(module.MAGIC, module.VERSION, nonce)
        plain = module._serialize(self.dexes) + b"x"
        malformed = header + AESGCM(self.key).encrypt(nonce, plain, header)
        with self.assertRaises(PayloadError):
            unpack_payload(malformed, self.key)


if __name__ == "__main__":
    unittest.main()
