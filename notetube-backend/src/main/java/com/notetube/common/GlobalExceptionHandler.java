package com.notetube.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Turns every failure into the contract's JSON error shape.
 * Extending ResponseEntityExceptionHandler covers Spring's standard web exceptions (bad JSON, wrong
 * content type, wrong method, unknown route...). We override one hook so none of them leak Spring's
 * own message or body.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Object> handleApi(ApiException e) {
        return json(e.code().status(), ErrorResponse.of(e.code(), e.getMessage(), e.fields()), null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleUnexpected(Exception e) {
        log.error("Unhandled exception ({})", e.getClass().getSimpleName(), e);
        return json(HttpStatus.INTERNAL_SERVER_ERROR,
                ErrorResponse.of(ErrorCode.UNKNOWN, ErrorCode.UNKNOWN.defaultMessage(), null), null);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(fe -> fields.putIfAbsent(fe.getField(), fe.getDefaultMessage()));
        return json(HttpStatus.BAD_REQUEST,
                ErrorResponse.of(ErrorCode.VALIDATION, ErrorCode.VALIDATION.defaultMessage(), fields), headers);
    }

    /** Every other Spring web exception funnels through here. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, @Nullable Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ErrorCode code = codeFor(statusCode.value());
        if (statusCode.is5xxServerError()) {
            log.error("Framework exception ({})", ex.getClass().getSimpleName(), ex);
        }
        return json(statusCode, ErrorResponse.of(code, code.defaultMessage(), null), headers);
    }

    static ErrorCode codeFor(int status) {
        return switch (status) {
            case 400 -> ErrorCode.VALIDATION;
            case 401 -> ErrorCode.UNAUTHENTICATED;
            case 403 -> ErrorCode.FORBIDDEN;
            case 404 -> ErrorCode.NOT_FOUND;
            case 405 -> ErrorCode.METHOD_NOT_ALLOWED;
            case 406 -> ErrorCode.NOT_ACCEPTABLE;
            case 413 -> ErrorCode.PAYLOAD_TOO_LARGE;
            case 415 -> ErrorCode.UNSUPPORTED_MEDIA_TYPE;
            case 429 -> ErrorCode.RATE_LIMITED;
            default -> status >= 500 ? ErrorCode.UNKNOWN : ErrorCode.VALIDATION;
        };
    }

    private static ResponseEntity<Object> json(HttpStatusCode status, ErrorResponse body, @Nullable HttpHeaders inherited) {
        HttpHeaders headers = new HttpHeaders();
        if (inherited != null) {
            headers.putAll(inherited); // keeps e.g. the Allow header on 405
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new ResponseEntity<>(body, headers, status);
    }
}
