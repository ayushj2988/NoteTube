package com.notetube.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notetube.common.ApiException;
import com.notetube.common.ErrorCode;
import com.notetube.config.AppProperties;
import com.notetube.config.HttpClients;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.time.Clock;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Verifies Google ID tokens locally: RS256 signature against Google's published keys, then issuer,
 * audience (= GOOGLE_CLIENT_ID) and expiry. Needs no extra libraries.
 */
@Component
public class GoogleJwtVerifier implements GoogleTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleJwtVerifier.class);
    private static final String CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final RestClient http = HttpClients.create(5_000, 10_000);

    private volatile Map<String, PublicKey> keys = Map.of();
    private volatile long fetchedAt = 0;

    public GoogleJwtVerifier(AppProperties props, ObjectMapper mapper, Clock clock) {
        this.props = props;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Override
    public GoogleIdentity verify(String credential) {
        try {
            return doVerify(credential);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google token rejected ({})", e.getClass().getSimpleName());
            throw invalid();
        }
    }

    private GoogleIdentity doVerify(String credential) throws Exception {
        String[] parts = credential.split("\\.");
        if (parts.length != 3) {
            throw invalid();
        }
        Base64.Decoder b64 = Base64.getUrlDecoder();
        JsonNode header = mapper.readTree(b64.decode(parts[0]));
        if (!"RS256".equals(header.path("alg").asText())) {
            throw invalid();
        }
        PublicKey key = keyFor(header.path("kid").asText());
        if (key == null) {
            throw invalid();
        }
        Signature sig = Signature.getInstance("SHA256withRSA");
        sig.initVerify(key);
        sig.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        if (!sig.verify(b64.decode(parts[2]))) {
            throw invalid();
        }

        JsonNode c = mapper.readTree(b64.decode(parts[1]));
        String iss = c.path("iss").asText();
        if (!"accounts.google.com".equals(iss) && !"https://accounts.google.com".equals(iss)) {
            throw invalid();
        }
        if (!props.googleClientId().equals(c.path("aud").asText())) {
            throw invalid();
        }
        if (c.path("exp").asLong(0) + 60 < clock.instant().getEpochSecond()) {
            throw invalid();
        }
        String sub = c.path("sub").asText("");
        String email = c.path("email").asText("");
        if (sub.isBlank() || email.isBlank()) {
            throw invalid();
        }
        return new GoogleIdentity(sub, email, c.path("email_verified").asBoolean(false), c.path("name").asText(""));
    }

    private PublicKey keyFor(String kid) throws Exception {
        long now = clock.millis();
        boolean unknownKid = !keys.containsKey(kid) && now - fetchedAt > 60_000;
        boolean stale = now - fetchedAt > 3_600_000;
        if (unknownKid || stale) {
            refresh(now);
        }
        return keys.get(kid);
    }

    private synchronized void refresh(long now) throws Exception {
        JsonNode root = http.get().uri(CERTS_URL).retrieve().body(JsonNode.class);
        Map<String, PublicKey> fresh = new HashMap<>();
        KeyFactory kf = KeyFactory.getInstance("RSA");
        Base64.Decoder b64 = Base64.getUrlDecoder();
        for (JsonNode k : root.path("keys")) {
            if (!"RSA".equals(k.path("kty").asText())) {
                continue;
            }
            BigInteger n = new BigInteger(1, b64.decode(k.path("n").asText()));
            BigInteger e = new BigInteger(1, b64.decode(k.path("e").asText()));
            fresh.put(k.path("kid").asText(), kf.generatePublic(new RSAPublicKeySpec(n, e)));
        }
        keys = fresh;
        fetchedAt = now;
    }

    private static ApiException invalid() {
        return new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google sign-in failed. Please try again.");
    }
}
