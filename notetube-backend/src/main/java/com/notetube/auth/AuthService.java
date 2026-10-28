package com.notetube.auth;

import com.notetube.auth.AuthDtos.SignupRequest;
import com.notetube.common.ApiException;
import com.notetube.common.ErrorCode;
import com.notetube.common.Ids;
import com.notetube.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    /** Compared against when the email is unknown, so timing does not reveal which emails exist. */
    private static final String DUMMY_HASH = new BCryptPasswordEncoder().encode("not-a-real-password");

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final GoogleTokenVerifier google;
    private final AppProperties props;
    private final Clock clock;

    public AuthService(UserRepository users, PasswordEncoder encoder, GoogleTokenVerifier google,
                       AppProperties props, Clock clock) {
        this.users = users;
        this.encoder = encoder;
        this.google = google;
        this.props = props;
        this.clock = clock;
    }

    @Transactional
    public User signup(SignupRequest r) {
        if (r.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(ErrorCode.VALIDATION, ErrorCode.VALIDATION.defaultMessage(),
                    Map.of("password", "Use at most 72 bytes (fewer special characters)"));
        }
        if (users.existsByEmail(r.email())) {
            throw emailTaken();
        }
        User u = new User(Ids.newId("u_"), r.name(), r.email(), encoder.encode(r.password()), null, clock.instant());
        try {
            return users.saveAndFlush(u);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken(); // two signups raced past existsByEmail
        }
    }

    /** Same 401 for unknown email, wrong password and Google-only accounts. */
    @Transactional(readOnly = true)
    public User login(String email, String password) {
        Optional<User> found = users.findByEmail(email);
        String hash = found.map(u -> u.passwordHash).orElse(DUMMY_HASH);
        boolean tooLong = password.getBytes(StandardCharsets.UTF_8).length > 72;
        boolean matches = !tooLong && encoder.matches(password, hash);
        if (found.isEmpty() || found.get().passwordHash == null || !matches) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
        }
        return found.get();
    }

    /**
     * Account policy: the Google "sub" is the identity key. If the sub is new but the verified email
     * already belongs to a password account, we do NOT link them automatically (that could let someone
     * take over an account). The user must sign in with their password.
     */
    @Transactional
    public User loginWithGoogle(String credential) {
        if (props.googleClientId() == null || props.googleClientId().isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION, "Google sign-in is not configured on this server");
        }
        GoogleIdentity id = google.verify(credential);
        if (!id.emailVerified()) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Your Google email address is not verified");
        }
        Optional<User> bySub = users.findByGoogleSub(id.sub());
        if (bySub.isPresent()) {
            return bySub.get();
        }
        String email = id.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) {
            throw new ApiException(ErrorCode.EMAIL_TAKEN,
                    "An account with this email already exists. Please sign in with your password.");
        }
        String name = id.name() == null || id.name().isBlank() ? email.substring(0, email.indexOf('@')) : id.name().trim();
        if (name.length() > 100) {
            name = name.substring(0, 100);
        }
        try {
            return users.saveAndFlush(new User(Ids.newId("u_"), name, email, null, id.sub(), clock.instant()));
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
    }

    @Transactional(readOnly = true)
    public User requireUser(String id) {
        return users.findById(id).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED));
    }

    @Transactional
    public User updateMe(String id, String name, String email) {
        User u = requireUser(id);
        if (name != null) {
            u.name = name;
        }
        if (email != null && !email.equals(u.email)) {
            if (users.existsByEmail(email)) {
                throw emailTaken();
            }
            u.email = email;
        }
        try {
            return users.saveAndFlush(u);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
    }

    private static ApiException emailTaken() {
        return new ApiException(ErrorCode.EMAIL_TAKEN);
    }
}
