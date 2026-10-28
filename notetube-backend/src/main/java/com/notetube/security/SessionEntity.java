package com.notetube.security;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A login session. Only the hash of the cookie token is stored, never the token itself. */
@Entity
@Table(name = "sessions")
public class SessionEntity {
    @Id
    public String tokenHash;
    public String userId;
    public Instant expiresAt;
    public Instant createdAt;

    protected SessionEntity() {}

    public SessionEntity(String tokenHash, String userId, Instant expiresAt, Instant createdAt) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }
}
