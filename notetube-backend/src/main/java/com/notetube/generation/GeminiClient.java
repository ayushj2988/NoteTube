package com.notetube.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.notetube.config.AppProperties;
import com.notetube.config.HttpClients;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Minimal Gemini generateContent client (REST, key sent in the x-goog-api-key header).
 * 60 s timeout, up to 3 attempts on 429/503 with exponential backoff, shared requests-per-minute limit.
 * Never logs prompts, transcripts, keys or response bodies.
 */
public class GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);
    private static final String BASE = "https://generativelanguage.googleapis.com/v1beta";
    private static final int MAX_ATTEMPTS = 3;

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final GeminiRateLimiter limiter;
    private final RestClient http = HttpClients.create(10_000, 60_000);

    public GeminiClient(AppProperties props, ObjectMapper mapper, GeminiRateLimiter limiter) {
        this.props = props;
        this.mapper = mapper;
        this.limiter = limiter;
    }

    /**
     * @param videoUrl optional public YouTube URL sent as video input (file_data.file_uri)
     * @param schema   JSON Schema for the structured answer (generationConfig.responseJsonSchema)
     * @return the model's JSON text
     */
    public String generate(String systemPrompt, String userText, String videoUrl, JsonNode schema) {
        ObjectNode body = mapper.createObjectNode();
        body.putObject("system_instruction").putArray("parts").addObject().put("text", systemPrompt);
        ObjectNode content = body.putArray("contents").addObject();
        content.put("role", "user");
        ArrayNode parts = content.putArray("parts");
        if (videoUrl != null) {
            parts.addObject().putObject("file_data").put("file_uri", videoUrl);
        }
        parts.addObject().put("text", userText);
        ObjectNode cfg = body.putObject("generationConfig");
        cfg.put("responseMimeType", "application/json");
        cfg.set("responseJsonSchema", schema);

        for (int attempt = 1; ; attempt++) {
            limiter.acquire();
            try {
                JsonNode resp = http.post()
                        .uri(BASE + "/models/{model}:generateContent", props.geminiModel())
                        .header("x-goog-api-key", props.geminiApiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(JsonNode.class);
                return extractText(resp);
            } catch (RestClientResponseException e) {
                int status = e.getStatusCode().value();
                if ((status == 429 || status == 503) && attempt < MAX_ATTEMPTS) {
                    log.warn("Gemini returned {}; retrying (attempt {} of {})", status, attempt, MAX_ATTEMPTS);
                    backoff(attempt);
                    continue;
                }
                log.warn("Gemini request failed with HTTP {}", status);
                throw new GenerationException("AI_FAILED",
                        "The AI service returned an error (" + status + "). Please retry in a minute.", status);
            } catch (ResourceAccessException e) {
                log.warn("Gemini request timed out or could not connect");
                throw new GenerationException("AI_FAILED", "The AI service did not respond in time. Please retry.");
            }
        }
    }

    private static String extractText(JsonNode resp) {
        StringBuilder sb = new StringBuilder();
        if (resp != null) {
            for (JsonNode part : resp.path("candidates").path(0).path("content").path("parts")) {
                if (!part.path("thought").asBoolean(false) && part.has("text")) {
                    sb.append(part.path("text").asText());
                }
            }
        }
        if (sb.isEmpty()) {
            throw new GenerationException("AI_FAILED", "The AI returned an empty answer. Please retry.");
        }
        return sb.toString();
    }

    private static void backoff(int attempt) {
        long ms = (1000L << (attempt - 1)) + ThreadLocalRandom.current().nextLong(0, 250);
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GenerationException("UNKNOWN", "Generation was interrupted.");
        }
    }
}
