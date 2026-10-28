package com.notetube.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** All NoteTube settings, bound from the "app.*" keys in application.yml (which read the env vars). */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String environment,
        String databaseUrl,
        String frontendUrl,
        String sessionSecret,
        int sessionDays,
        String googleClientId,
        String geminiApiKey,
        String geminiModel,
        String youtubeApiKey,
        int dailyGenerationLimit,
        int maxVideoMinutes,
        boolean trustProxy,
        int workerConcurrency,
        int geminiMaxRpm,
        int authRateLimit,
        int noteRateLimit) {

    public boolean isProduction() {
        return "production".equalsIgnoreCase(environment);
    }

    /** No Gemini key means the fake generator is used. */
    public boolean isDemoMode() {
        return geminiApiKey == null || geminiApiKey.isBlank();
    }

    /** Never print secrets: a record's default toString would include every field. */
    @Override
    public String toString() {
        return "AppProperties[environment=" + environment + ", demoMode=" + isDemoMode() + "]";
    }
}
