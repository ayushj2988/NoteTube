package com.notetube.notes;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Request and response shapes from docs/API.md. */
public final class NoteDtos {
    private NoteDtos() {}

    // ----- requests -----
    public record Extras(boolean flashcards, boolean quiz) {}

    public record CreateNoteRequest(
            @Size(max = 500, message = "That link is too long") String url,
            String transcript,
            @Valid Extras extras) {}

    public record RetryRequest(String transcript) {}

    public record ExtrasRequest(boolean flashcards, boolean quiz) {}

    public record SectionInput(
            @Size(max = 64, message = "Section id is too long") String id,
            Integer ts,
            @NotBlank(message = "Each section needs a title") @Size(max = 300, message = "Section title is too long") String title,
            @NotNull(message = "Each section needs a body") @Size(max = 20000, message = "Section body is too long") String body) {}

    /** Every field optional. "sections" replaces the whole list when present. */
    public record UpdateNoteRequest(
            @Size(min = 1, max = 300, message = "Title must be 1 to 300 characters") String title,
            @Size(max = 100, message = "Subject is too long") String subject,
            @Size(max = 20000, message = "Summary is too long") String summary,
            @Valid @Size(max = 200, message = "Too many sections") List<SectionInput> sections) {
        public UpdateNoteRequest {
            title = title == null ? null : title.trim();
            subject = subject == null ? null : subject.trim();
        }
    }

    // ----- responses -----
    public record IdResponse(String id) {}

    public record Progress(int transcript, int notes, int extras) {}

    public record ErrorInfo(String code, String message) {}

    public record ExtrasStatus(String flashcards, String quiz) {}

    public record Section(String id, Integer ts, String title, String body) {}

    public record Definition(String term, String def) {}

    public record NoteView(
            String id, String title, String subject, String youtubeId, Integer durationSec, String status,
            Progress progress, ErrorInfo error, ExtrasStatus extras, String summary, List<String> takeaways,
            List<Definition> definitions, List<Section> sections, Instant createdAt, Instant updatedAt) {}

    public record NoteResponse(NoteView note) {}

    public record NoteListItem(String id, String title, String subject, String status, Instant createdAt,
                               Progress progress, ExtrasStatus extras) {}

    public record NoteListResponse(List<NoteListItem> notes) {}
}
