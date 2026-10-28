package com.notetube.stats;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** One unit of activity (review, quiz or note) for the heatmap and streak. */
@Entity
@Table(name = "events")
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public String userId;
    public String kind;
    public Instant createdAt;

    protected Event() {}

    public Event(String userId, String kind, Instant createdAt) {
        this.userId = userId;
        this.kind = kind;
        this.createdAt = createdAt;
    }
}
