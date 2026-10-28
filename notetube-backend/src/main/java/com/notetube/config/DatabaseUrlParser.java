package com.notetube.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * Converts a Node-style URL (postgres://user:pass@host:5432/db) into JDBC settings.
 * A value that already starts with "jdbc:" is passed through untouched.
 * Error messages never contain the input, because it may hold a password.
 */
public final class DatabaseUrlParser {

    /** Redacted toString so the password and URL can never leak into logs. */
    public record JdbcSettings(String url, String username, String password) {
        @Override
        public String toString() {
            return "JdbcSettings[redacted]";
        }
    }

    private DatabaseUrlParser() {}

    public static JdbcSettings parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("DATABASE_URL is not set");
        }
        String value = raw.trim();
        if (value.startsWith("jdbc:")) {
            return new JdbcSettings(value, null, null);
        }
        URI uri;
        try {
            uri = new URI(value);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException(
                    "DATABASE_URL is not a valid URL (percent-encode special characters in the password)");
        }
        String scheme = uri.getScheme();
        if (!"postgres".equals(scheme) && !"postgresql".equals(scheme)) {
            throw new IllegalArgumentException("DATABASE_URL must start with postgres:// or postgresql://");
        }
        String host = uri.getHost();
        String path = uri.getRawPath();
        if (host == null || path == null || path.length() < 2) {
            throw new IllegalArgumentException("DATABASE_URL needs a host and a database name");
        }
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();

        String username = null;
        String password = null;
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null && !userInfo.isEmpty()) {
            int colon = userInfo.indexOf(':');
            username = decode(colon < 0 ? userInfo : userInfo.substring(0, colon));
            password = colon < 0 ? null : decode(userInfo.substring(colon + 1));
        }
        String query = uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
        String jdbc = "jdbc:postgresql://" + host + ":" + port + path + query;
        return new JdbcSettings(jdbc, username, password);
    }

    private static String decode(String s) {
        // URLDecoder turns '+' into a space; a literal '+' in a URL password is a plus.
        return URLDecoder.decode(s.replace("+", "%2B"), StandardCharsets.UTF_8);
    }
}
