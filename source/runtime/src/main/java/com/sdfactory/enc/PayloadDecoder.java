package com.sdfactory.enc;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * SDE2 payload decoder. Returns independent DEX buffers for the shell loader.
 * This class intentionally does not install a ClassLoader or start an app;
 * those operations belong to the manifest-aware Android shell integration.
 */
public final class PayloadDecoder {
    private static final byte[] MAGIC = new byte[] {'S', 'D', 'E', '2'};
    private static final int HEADER_SIZE = 17;
    private static final int NONCE_SIZE = 12;
    private static final int TAG_BITS = 128;
    private static final int MAX_COUNT = 64;
    private static final long MAX_TOTAL = 512L * 1024L * 1024L;

    private PayloadDecoder() {}

    public static ByteBuffer[] decode(byte[] container, byte[] key)
            throws GeneralSecurityException {
        if (container == null || container.length < HEADER_SIZE + 20) {
            throw new GeneralSecurityException("Truncated SDE2 payload");
        }
        if (key == null || key.length != 32) {
            throw new GeneralSecurityException("Invalid SDE2 key");
        }
        ByteBuffer input = ByteBuffer.wrap(container).order(ByteOrder.BIG_ENDIAN);
        for (byte b : MAGIC) {
            if (input.get() != b) throw new GeneralSecurityException("Bad SDE2 magic");
        }
        int version = input.get() & 0xff;
        if (version != 1) throw new GeneralSecurityException("Unsupported SDE2 version");
        byte[] nonce = new byte[NONCE_SIZE];
        input.get(nonce);
        byte[] aad = new byte[HEADER_SIZE];
        System.arraycopy(container, 0, aad, 0, HEADER_SIZE);
        byte[] ciphertext = new byte[container.length - HEADER_SIZE];
        input.get(ciphertext);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
                new GCMParameterSpec(TAG_BITS, nonce));
        cipher.updateAAD(aad);
        byte[] plain = cipher.doFinal(ciphertext);

        ByteBuffer data = ByteBuffer.wrap(plain).order(ByteOrder.BIG_ENDIAN);
        if (data.remaining() < 4) throw new GeneralSecurityException("Missing DEX index");
        int count = data.getInt();
        if (count < 1 || count > MAX_COUNT) {
            throw new GeneralSecurityException("Invalid DEX count");
        }
        List<ByteBuffer> dexBuffers = new ArrayList<>(count);
        long total = 0;
        for (int i = 0; i < count; i++) {
            if (data.remaining() < 8) throw new GeneralSecurityException("Truncated DEX entry");
            long size = data.getLong();
            if (size < 112 || size > MAX_TOTAL || size > data.remaining()) {
                throw new GeneralSecurityException("Invalid DEX entry size");
            }
            byte[] dex = new byte[(int) size];
            data.get(dex);
            if (dex[0] != 'd' || dex[1] != 'e' || dex[2] != 'x'
                    || dex[3] != '\n' || dex[7] != 0) {
                throw new GeneralSecurityException("Invalid DEX magic");
            }
            long declared = ((long) dex[32] & 0xff)
                    | (((long) dex[33] & 0xff) << 8)
                    | (((long) dex[34] & 0xff) << 16)
                    | (((long) dex[35] & 0xff) << 24);
            if (declared != size) throw new GeneralSecurityException("Invalid DEX size field");
            total += size;
            if (total > MAX_TOTAL) throw new GeneralSecurityException("DEX payload too large");
            dexBuffers.add(ByteBuffer.wrap(dex).asReadOnlyBuffer());
        }
        if (data.hasRemaining()) throw new GeneralSecurityException("Trailing payload bytes");
        return dexBuffers.toArray(new ByteBuffer[0]);
    }
}
