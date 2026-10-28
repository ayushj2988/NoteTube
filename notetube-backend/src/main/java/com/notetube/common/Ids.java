package com.notetube.common;

import java.security.SecureRandom;
import java.util.HexFormat;

public final class Ids {
    private static final SecureRandom RNG = new SecureRandom();

    private Ids() {}

    /** prefix + 32 hex characters from 16 cryptographically random bytes, e.g. n_3fa9... */
    public static String newId(String prefix) {
        byte[] b = new byte[16];
        RNG.nextBytes(b);
        return prefix + HexFormat.of().formatHex(b);
    }
}
