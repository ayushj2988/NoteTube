package com.notetube.auth;

/** Verifies a Google ID token. An interface so tests can mock it. */
public interface GoogleTokenVerifier {
    /** Throws ApiException(INVALID_CREDENTIALS) if the token is not valid for this app. */
    GoogleIdentity verify(String credential);
}
