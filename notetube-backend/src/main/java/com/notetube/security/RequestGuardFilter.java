package com.notetube.security;

import com.notetube.common.ErrorCode;
import com.notetube.common.ErrorWriter;
import com.notetube.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * CSRF defence for cookie sessions (instead of CSRF tokens), plus request-size limits:
 *  - state-changing requests with an Origin header must come from FRONTEND_URL or this server itself (403)
 *  - bodies over 1 MB (2 MB for creating/retrying notes) are rejected (413)
 *  - requests that carry a body must be application/json (415). Bodyless POST/DELETE are fine.
 */
public class RequestGuardFilter extends OncePerRequestFilter {

    private static final long DEFAULT_LIMIT = 1_000_000L;
    private static final long NOTES_LIMIT = 2_000_000L;
    private static final Set<String> CHANGING = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final Set<String> allowedOrigins;
    private final ErrorWriter errors;

    public RequestGuardFilter(AppProperties props, ErrorWriter errors) {
        this.allowedOrigins = parseOrigins(props.frontendUrl());
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (CHANGING.contains(req.getMethod())) {
            String origin = req.getHeader("Origin");
            if (origin != null && !allowedOrigins.contains(origin) && !origin.equals(selfOrigin(req))) {
                errors.write(res, ErrorCode.FORBIDDEN, "Requests from this origin are not allowed");
                return;
            }
            long len = req.getContentLengthLong();
            boolean chunked = req.getHeader("Transfer-Encoding") != null;
            if (len > limitFor(req.getRequestURI()) || (len < 0 && chunked)) {
                errors.write(res, ErrorCode.PAYLOAD_TOO_LARGE);
                return;
            }
            if ((len > 0 || chunked) && !isJson(req.getContentType())) {
                errors.write(res, ErrorCode.UNSUPPORTED_MEDIA_TYPE);
                return;
            }
        }
        chain.doFilter(req, res);
    }

    private static long limitFor(String path) {
        if (path.equals("/api/notes") || path.matches("/api/notes/[^/]+/retry")) {
            return NOTES_LIMIT;
        }
        return DEFAULT_LIMIT;
    }

    private static boolean isJson(String contentType) {
        return contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("application/json");
    }

    private static String selfOrigin(HttpServletRequest req) {
        int port = req.getServerPort();
        boolean defaultPort = ("http".equals(req.getScheme()) && port == 80) || ("https".equals(req.getScheme()) && port == 443);
        return req.getScheme() + "://" + req.getServerName() + (defaultPort ? "" : ":" + port);
    }

    /** FRONTEND_URL may hold several comma-separated URLs. Only scheme://host[:port] is kept. */
    static Set<String> parseOrigins(String frontendUrl) {
        Set<String> out = new HashSet<>();
        if (frontendUrl == null) {
            return out;
        }
        for (String part : frontendUrl.split(",")) {
            String p = part.trim();
            if (p.isEmpty()) {
                continue;
            }
            try {
                URI u = URI.create(p);
                if (u.getScheme() != null && u.getHost() != null) {
                    out.add(u.getScheme() + "://" + u.getHost() + (u.getPort() == -1 ? "" : ":" + u.getPort()));
                }
            } catch (IllegalArgumentException ignored) {
                // malformed entry: skip it
            }
        }
        return out;
    }
}
