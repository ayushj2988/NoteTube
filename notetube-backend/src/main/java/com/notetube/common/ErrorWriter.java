package com.notetube.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;

/** Writes the contract error JSON from servlet filters and security handlers (outside MVC). */
@Component
public class ErrorWriter {

    private final ObjectMapper mapper;

    public ErrorWriter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public void write(HttpServletResponse res, ErrorCode code) throws IOException {
        write(res, code, code.defaultMessage());
    }

    public void write(HttpServletResponse res, ErrorCode code, String message) throws IOException {
        res.setStatus(code.status().value());
        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        mapper.writeValue(res.getWriter(), ErrorResponse.of(code, message, null));
    }
}
