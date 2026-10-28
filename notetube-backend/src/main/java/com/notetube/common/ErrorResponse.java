package com.notetube.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** JSON shape: { "error": { "code", "message", "fields"? } }. "fields" is only present for VALIDATION. */
public record ErrorResponse(Body error) {

    public record Body(String code, String message, @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, String> fields) {}

    public static ErrorResponse of(ErrorCode code, String message, Map<String, String> fields) {
        return new ErrorResponse(new Body(code.name(), message, fields));
    }
}
