package com.notetube.auth;

/** The verified claims we use from a Google ID token. */
public record GoogleIdentity(String sub, String email, boolean emailVerified, String name) {}
