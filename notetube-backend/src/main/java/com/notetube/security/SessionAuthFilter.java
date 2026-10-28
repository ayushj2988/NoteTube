package com.notetube.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Reads the nt_session cookie and, if it maps to a live session, authenticates the request. */
public class SessionAuthFilter extends OncePerRequestFilter {

    private final SessionService sessions;

    public SessionAuthFilter(SessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        SessionCookies.read(req).flatMap(sessions::validate).ifPresent(userId -> {
            SecurityContext ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(new UsernamePasswordAuthenticationToken(new AuthUser(userId), null, List.of()));
            SecurityContextHolder.setContext(ctx);
        });
        chain.doFilter(req, res);
    }
}
