package com.notetube.notes;

import java.time.Instant;

/** Lightweight projection so list pages do not load transcripts and full note bodies. */
public record NoteListRow(
        String id,
        String title,
        String subject,
        String status,
        Instant createdAt,
        int progressTranscript,
        int progressNotes,
        int progressExtras,
        String flashcardsStatus,
        String quizStatus) {}
