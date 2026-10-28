package com.notetube.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public final class AuthDtos {
    private AuthDtos() {}

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    private static String normEmail(String s) {
        return s == null ? null : s.trim().toLowerCase(Locale.ROOT);
    }

    public record SignupRequest(
            @NotBlank(message = "Enter your name") @Size(max = 100, message = "Name is too long") String name,
            @NotBlank(message = "Enter your email") @Email(message = "Enter a valid email")
            @Size(max = 254, message = "Email is too long") String email,
            @NotBlank(message = "Enter a password") @Size(min = 8, max = 72, message = "Use 8 to 72 characters") String password) {
        public SignupRequest {
            name = trim(name);
            email = normEmail(email);
        }
    }

    public record LoginRequest(
            @NotBlank(message = "Enter your email") String email,
            @NotBlank(message = "Enter your password") String password) {
        public LoginRequest {
            email = normEmail(email);
        }
    }

    /** Both fields optional; a missing field means "leave unchanged". */
    public record UpdateMeRequest(
            @Size(min = 1, max = 100, message = "Name must be 1 to 100 characters") String name,
            @Email(message = "Enter a valid email") @Size(max = 254, message = "Email is too long") String email) {
        public UpdateMeRequest {
            name = trim(name);
            email = normEmail(email);
        }
    }

    public record GoogleRequest(@NotBlank(message = "Missing Google credential") String credential) {}

    public record UserDto(String id, String name, String email) {
        public static UserDto from(User u) {
            return new UserDto(u.id, u.name, u.email);
        }
    }

    public record UserResponse(UserDto user) {}
}
