package com.notetube.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

/** Small helper for the JSON-in-a-text-column fields (sections, options, mistakes...). */
@Component
public class JsonCodec {

    private final ObjectMapper mapper;

    public JsonCodec(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String write(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise JSON", e);
        }
    }

    public <T> T read(String json, TypeReference<T> type, T whenEmpty) {
        if (json == null || json.isBlank()) {
            return whenEmpty;
        }
        try {
            return mapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored JSON is corrupt", e);
        }
    }

    public ObjectMapper mapper() {
        return mapper;
    }
}
