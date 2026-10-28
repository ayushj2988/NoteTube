package com.notetube.auth;

import com.notetube.auth.AuthDtos.GoogleRequest;
import com.notetube.auth.AuthDtos.LoginRequest;
import com.notetube.auth.AuthDtos.SignupRequest;
import com.notetube.auth.AuthDtos.UpdateMeRequest;
import com.notetube.auth.AuthDtos.UserDto;
import com.notetube.auth.AuthDtos.UserResponse;
import com.notetube.security.AuthUser;
import com.notetube.security.SessionCookies;
import com.notetube.security.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final SessionService sessions;
    private final SessionCookies cookies;

    public AuthController(AuthService auth, SessionService sessions, SessionCookies cookies) {
        this.auth = auth;
        this.sessions = sessions;
        this.cookies = cookies;
    }

    @PostMapping("/signup")
    public ResponseEntity<UserResponse> signup(@Valid @RequestBody SignupRequest req) {
        return startSession(HttpStatus.CREATED, auth.signup(req));
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest req) {
        return startSession(HttpStatus.OK, auth.login(req.email(), req.password()));
    }

    /** Not in docs/API.md: proposed endpoint for Google sign-in. Body: {"credential": "<Google ID token>"}. */
    @PostMapping("/google")
    public ResponseEntity<UserResponse> google(@Valid @RequestBody GoogleRequest req) {
        return startSession(HttpStatus.OK, auth.loginWithGoogle(req.credential()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        SessionCookies.read(request).ifPresent(sessions::delete);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthUser principal) {
        return new UserResponse(UserDto.from(auth.requireUser(principal.id())));
    }

    @PatchMapping("/me")
    public UserResponse updateMe(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody UpdateMeRequest req) {
        return new UserResponse(UserDto.from(auth.updateMe(principal.id(), req.name(), req.email())));
    }

    private ResponseEntity<UserResponse> startSession(HttpStatus status, User user) {
        String token = sessions.create(user.id);
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookies.create(token).toString())
                .body(new UserResponse(UserDto.from(user)));
    }
}
