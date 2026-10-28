package com.notetube.common;

import jakarta.servlet.http.HttpServletRequest;

public final class ClientIp {
    private ClientIp() {}

    /**
     * With TRUST_PROXY=false the socket address is used and X-Forwarded-For is ignored completely.
     * With TRUST_PROXY=true we take the LAST X-Forwarded-For entry, the one added by our own proxy;
     * earlier entries can be forged by the client.
     */
    public static String of(HttpServletRequest req, boolean trustProxy) {
        if (trustProxy) {
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                String[] parts = xff.split(",");
                return parts[parts.length - 1].trim();
            }
        }
        return req.getRemoteAddr();
    }
}
