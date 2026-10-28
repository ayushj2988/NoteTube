package com.notetube.generation;

/** A known generation failure. The code is one the frontend understands (NO_CAPTIONS, AI_FAILED...). */
public class GenerationException extends RuntimeException {
    private final String code;
    private final int httpStatus;

    public GenerationException(String code, String message) {
        this(code, message, 0);
    }

    public GenerationException(String code, String message, int httpStatus) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
    }

    public String code() {
        return code;
    }

    /** HTTP status of the failing AI call, or 0 if not applicable. */
    public int httpStatus() {
        return httpStatus;
    }
}
