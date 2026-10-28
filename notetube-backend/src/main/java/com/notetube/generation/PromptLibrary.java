package com.notetube.generation;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Loads prompt files from src/main/resources/prompts/ (cached). */
@Component
public class PromptLibrary {

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public String get(String fileName) {
        return cache.computeIfAbsent(fileName, f -> {
            try (var in = new ClassPathResource("prompts/" + f).getInputStream()) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException("Missing prompt file prompts/" + f, e);
            }
        });
    }
}
