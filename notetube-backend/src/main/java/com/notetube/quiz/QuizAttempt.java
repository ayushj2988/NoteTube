package com.notetube.quiz;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "quiz_attempts")
public class QuizAttempt {
    @Id
    public String id;
    public String noteId;
    public String userId;
    public int score;
    public int total;
    public String mistakes; // JSON array of {questionId, topic}
    public Instant createdAt;

    protected QuizAttempt() {}

    public QuizAttempt(String id, String noteId, String userId, int score, int total, String mistakes, Instant createdAt) {
        this.id = id;
        this.noteId = noteId;
        this.userId = userId;
        this.score = score;
        this.total = total;
        this.mistakes = mistakes;
        this.createdAt = createdAt;
    }
}
