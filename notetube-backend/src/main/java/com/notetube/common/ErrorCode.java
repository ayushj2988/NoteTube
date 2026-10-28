package com.notetube.common;

import org.springframework.http.HttpStatus;

/** Stable error codes returned to the frontend, each with its HTTP status and a safe default message. */
public enum ErrorCode {
    VALIDATION(HttpStatus.BAD_REQUEST, "Please check your input"),
    INVALID_URL(HttpStatus.BAD_REQUEST, "That doesn't look like a valid, public YouTube link"),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Please sign in to continue"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Email or password is incorrect"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "You don't have access to this"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "We couldn't find that"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "That method isn't allowed here"),
    NOT_ACCEPTABLE(HttpStatus.NOT_ACCEPTABLE, "This API only returns JSON"),
    EMAIL_TAKEN(HttpStatus.CONFLICT, "An account with this email already exists"),
    NOT_READY(HttpStatus.CONFLICT, "This note isn't ready yet"),
    PAYLOAD_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "That request is too large"),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Send the request as application/json"),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please wait a moment and try again"),
    UNKNOWN(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong on our side");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
