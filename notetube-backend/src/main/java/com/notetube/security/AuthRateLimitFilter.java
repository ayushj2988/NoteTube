package com.notetube.security;

import com.notetube.common.ClientIp;
import com.notetube.common.ErrorCode;
import com.notetube.common.ErrorWriter;
import com.notetube.common.RateLimiter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/** 10 signup/login/google attempts per 15 minutes per IP (limit comes from RateLimits). */
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> PATHS = Set.of("/api/auth/signup", "/api/auth/login", "/api/auth/google");

    private final RateLimiter limiter;
    private final boolean trustProxy;
    private final ErrorWriter errors;

    public AuthRateLimitFilter(RateLimiter limiter, boolean trustProxy, ErrorWriter errors) {
        this.limiter = limiter;
        this.trustProxy = trustProxy;
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long wait = limiter.tryAcquire(ClientIp.of(req, trustProxy));
        if (wait > 0) {
            res.setHeader("Retry-After", Long.toString(wait));
            errors.write(res, ErrorCode.RATE_LIMITED, "Too many attempts. Please try again in " + wait + " seconds.");
            return;
        }
        chain.doFilter(req, res);
    }
}
