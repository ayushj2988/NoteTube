package com.notetube.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

    record Body(@NotBlank(message = "Enter your name") String name, @Email(message = "Enter a valid email") String email) {}

    @RestController
    static class ProbeController {
        @PostMapping("/probe/validate")
        String validate(@Valid @RequestBody Body b) { return "ok"; }

        @PostMapping("/probe/conflict")
        String conflict() { throw new ApiException(ErrorCode.EMAIL_TAKEN); }

        @PostMapping("/probe/boom")
        String boom() { throw new IllegalStateException("db password is hunter2"); }
    }

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void validationReturnsFieldErrors() throws Exception {
        mvc.perform(post("/probe/validate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"email\":\"nope\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"))
                .andExpect(jsonPath("$.error.fields.email").value("Enter a valid email"))
                .andExpect(jsonPath("$.error.fields.name").value("Enter your name"));
    }

    @Test
    void apiExceptionHasNoFieldsProperty() throws Exception {
        mvc.perform(post("/probe/conflict").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN"))
                .andExpect(jsonPath("$.error.fields").doesNotExist());
    }

    @Test
    void malformedJsonIsValidationError() throws Exception {
        mvc.perform(post("/probe/validate").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"))
                .andExpect(jsonPath("$.error.fields").doesNotExist());
    }

    @Test
    void wrongContentTypeIs415() throws Exception {
        mvc.perform(post("/probe/validate").contentType(MediaType.TEXT_PLAIN).content("hi"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void wrongMethodIs405() throws Exception {
        mvc.perform(get("/probe/validate"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void unexpectedErrorsAreGenericAndLeakNothing() throws Exception {
        mvc.perform(post("/probe/boom").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("UNKNOWN"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("hunter2"))));
    }
}
