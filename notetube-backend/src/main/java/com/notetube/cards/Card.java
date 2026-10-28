package com.notetube.cards;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "cards")
public class Card {
    @Id
    public String id;
    public String noteId;
    public String front;
    public String back;
    public double ease;
    public int intervalDays;
    public Instant dueAt;
    public int reviewCount;
    public Instant createdAt;

    protected Card() {}

    public Card(String id, String noteId, String front, String back, Instant now) {
        this.id = id;
        this.noteId = noteId;
        this.front = front;
        this.back = back;
        this.ease = SpacedRepetition.INITIAL_EASE;
        this.intervalDays = 0;
        this.dueAt = now; // new cards are due immediately
        this.reviewCount = 0;
        this.createdAt = now;
    }
}
