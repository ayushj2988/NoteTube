package com.notetube.common;

import java.util.Map;

/** Thrown anywhere in the app to produce a contract-shaped error response. */
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final Map<String, String> fields;

    public ApiException(ErrorCode code) {
        this(code, code.defaultMessage(), null);
    }

    public ApiException(ErrorCode code, String message) {
        this(code, message, null);
    }

    public ApiException(ErrorCode code, String message, Map<String, String> fields) {
        super(message, null, false, false); // no stack trace: these are expected outcomes
        this.code = code;
        this.fields = fields;
    }

    public ErrorCode code() {
        return code;
    }

    public Map<String, String> fields() {
        return fields;
    }
}
