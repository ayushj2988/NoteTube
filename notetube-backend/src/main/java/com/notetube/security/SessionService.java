package com.notetube.security;

import com.notetube.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Creates, validates and deletes sessions.
 * The cookie holds a random 32-byte token. The database stores HMAC-SHA256(SESSION_SECRET, token),
 * so a leaked database cannot be used to log in.
 */
@Service
public class SessionService {

    private static final Logger log = LoggerFactory.getLogger(SessionService.class);

    private final SessionRepository repo;
    private final AppProperties props;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    private final byte[] key;

    public SessionService(SessionRepository repo, AppProperties props, Clock clock) {
        this.repo = repo;
        this.props = props;
        this.clock = clock;
        String secret = props.sessionSecret();
        // Dev convenience only; StartupValidator refuses a missing secret in production.
        this.key = (secret == null || secret.isBlank() ? "notetube-dev-only-secret" : secret)
                .getBytes(StandardCharsets.UTF_8);
    }

    /** Returns the raw token to put in the cookie. */
    public String create(String userId) {
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant now = clock.instant();
        repo.save(new SessionEntity(hash(token), userId, now.plus(Duration.ofDays(props.sessionDays())), now));
        return token;
    }

    /** Returns the user id if the token belongs to a live session. */
    public Optional<String> validate(String token) {
        if (token == null || token.isBlank() || token.length() > 100) {
            return Optional.empty();
        }
        return repo.findById(hash(token))
                .filter(s -> s.expiresAt.isAfter(clock.instant()))
                .map(s -> s.userId);
    }

    public void delete(String token) {
        if (token == null || token.isBlank() || token.length() > 100) {
            return;
        }
        repo.findById(hash(token)).ifPresent(repo::delete);
    }

    @Scheduled(fixedDelay = 3_600_000L, initialDelay = 60_000L)
    public void cleanupExpired() {
        int n = repo.deleteExpired(clock.instant());
        if (n > 0) {
            log.info("Removed {} expired sessions", n);
        }
    }

    String hash(String token) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(token.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}
