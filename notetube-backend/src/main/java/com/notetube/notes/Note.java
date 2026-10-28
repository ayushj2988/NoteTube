package com.notetube.notes;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Set;

/** The core object. JSON-valued fields (takeaways, definitions, sections) are stored as JSON text. */
@Entity
@Table(name = "notes")
public class Note {
    public static final Set<String> PLACEHOLDER_TITLES = Set.of("Untitled note", "Pasted transcript", "YouTube video");

    @Id
    public String id;
    public String userId;
    public String title;
    public String subject;
    public String url;
    public String youtubeId;
    public String channel;
    public String thumbnailUrl;
    public Integer durationSec;
    public String status;
    public int progressTranscript;
    public int progressNotes;
    public int progressExtras;
    public String errorCode;
    public String errorMessage;
    public String summary;
    public String takeaways;
    public String definitions;
    public String sections;
    public String transcript;
    public boolean wantFlashcards;
    public boolean wantQuiz;
    public String flashcardsStatus;
    public String quizStatus;
    public Instant createdAt;
    public Instant updatedAt;

    protected Note() {}

    public Note(String id, String userId, Instant now) {
        this.id = id;
        this.userId = userId;
        this.status = NoteStatus.QUEUED;
        this.flashcardsStatus = NoteStatus.NONE;
        this.quizStatus = NoteStatus.NONE;
        this.createdAt = now;
        this.updatedAt = now;
    }
}
