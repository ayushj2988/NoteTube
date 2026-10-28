package com.notetube.generation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notetube.config.AppProperties;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GenerationConfig {

    /** No GEMINI_API_KEY = DEMO mode (fake generator). Otherwise the real Gemini generator. */
    @Bean
    public NoteGenerator noteGenerator(AppProperties props, ObjectMapper mapper, PromptLibrary prompts, Clock clock) {
        if (props.isDemoMode()) {
            return new DemoNoteGenerator();
        }
        GeminiClient client = new GeminiClient(props, mapper, new GeminiRateLimiter(props.geminiMaxRpm(), clock));
        return new GeminiNoteGenerator(client, prompts, mapper);
    }
}
