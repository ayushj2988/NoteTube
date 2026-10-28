package com.notetube.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A NoteTube account. passwordHash is null for Google-only accounts; googleSub is null for
 * password accounts. Fields are public to keep entities short; services own all mutations.
 */
@Entity
@Table(name = "users")
public class User {
    @Id
    public String id;
    public String name;
    public String email;
    public String passwordHash;
    public String googleSub;
    public Instant createdAt;

    protected User() {}

    public User(String id, String name, String email, String passwordHash, String googleSub, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.googleSub = googleSub;
        this.createdAt = createdAt;
    }
}
