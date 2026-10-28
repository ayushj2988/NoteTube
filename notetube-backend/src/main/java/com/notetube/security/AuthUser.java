package com.notetube.security;

/** The authenticated principal placed in the Spring Security context. */
public record AuthUser(String id) {}
