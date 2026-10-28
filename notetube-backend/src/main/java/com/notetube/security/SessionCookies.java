package com.notetube.security;

import com.notetube.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Optional;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class SessionCookies {

    public static final String NAME = "nt_session";

    private final AppProperties props;

    public SessionCookies(AppProperties props) {
        this.props = props;
    }

    public ResponseCookie create(String token) {
        return base(token).maxAge(Duration.ofDays(props.sessionDays())).build();
    }

    public ResponseCookie clear() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(props.isProduction())
                .sameSite("Lax")
                .path("/");
    }

    public static Optional<String> read(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie c : cookies) {
            if (NAME.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }
}
