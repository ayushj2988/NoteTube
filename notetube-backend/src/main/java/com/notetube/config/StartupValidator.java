package com.notetube.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;

/** Fails fast on unsafe production configuration and announces DEMO mode. */
@Component
public class StartupValidator implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(StartupValidator.class);
    /** 32 random bytes encoded as Base64 is 43 characters. */
    static final int MIN_SECRET_CHARS = 43;

    private final AppProperties props;

    public StartupValidator(AppProperties props) {
        this.props = props;
    }

    @Override
    public void afterPropertiesSet() {
        boolean secretOk = props.sessionSecret() != null && props.sessionSecret().length() >= MIN_SECRET_CHARS;
        if (props.isProduction()) {
            if (!secretOk) {
                throw new IllegalStateException(
                        "SESSION_SECRET is missing or too short (need 32+ random bytes, Base64) in production");
            }
            if (props.frontendUrl() == null || props.frontendUrl().isBlank()) {
                throw new IllegalStateException("FRONTEND_URL must be set in production");
            }
        } else if (!secretOk) {
            log.warn("SESSION_SECRET is missing or short. Fine for local development only.");
        }
        if (props.isDemoMode()) {
            log.warn("GEMINI_API_KEY not set: running in DEMO mode (fake generator, no AI calls).");
        } else {
            log.info("Gemini configured (model {}).", props.geminiModel());
        }
        if (props.youtubeApiKey() == null || props.youtubeApiKey().isBlank()) {
            log.warn("YOUTUBE_API_KEY not set: video metadata lookup will be unavailable.");
        }
        log.info("Environment: {}", props.environment());
        if (props.isProduction() && System.getProperty("spring.profiles.active", System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE", "")).isBlank()) {
            log.warn("Production is using the embedded H2 database. Set SPRING_PROFILES_ACTIVE=postgres for hosting.");
        }
    }
}
