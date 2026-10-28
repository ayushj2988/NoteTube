package com.notetube.notes;

import com.fasterxml.jackson.core.type.TypeReference;
import com.notetube.common.JsonCodec;
import com.notetube.notes.NoteDtos.Definition;
import com.notetube.notes.NoteDtos.ErrorInfo;
import com.notetube.notes.NoteDtos.ExtrasStatus;
import com.notetube.notes.NoteDtos.NoteListItem;
import com.notetube.notes.NoteDtos.NoteView;
import com.notetube.notes.NoteDtos.Progress;
import com.notetube.notes.NoteDtos.Section;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class NoteMapper {

    private final JsonCodec json;

    public NoteMapper(JsonCodec json) {
        this.json = json;
    }

    public List<String> takeaways(Note n) {
        return json.read(n.takeaways, new TypeReference<List<String>>() {}, List.of());
    }

    public List<Definition> definitions(Note n) {
        return json.read(n.definitions, new TypeReference<List<Definition>>() {}, List.of());
    }

    public List<Section> sections(Note n) {
        return json.read(n.sections, new TypeReference<List<Section>>() {}, List.of());
    }

    public NoteView toView(Note n) {
        ErrorInfo error = n.errorCode == null ? null : new ErrorInfo(n.errorCode, n.errorMessage);
        return new NoteView(n.id, n.title, n.subject, n.youtubeId, n.durationSec, n.status,
                new Progress(n.progressTranscript, n.progressNotes, n.progressExtras), error,
                new ExtrasStatus(n.flashcardsStatus, n.quizStatus),
                n.summary == null ? "" : n.summary, takeaways(n), definitions(n), sections(n),
                n.createdAt, n.updatedAt);
    }

    public NoteListItem toListItem(NoteListRow r) {
        return new NoteListItem(r.id(), r.title(), r.subject(), r.status(), r.createdAt(),
                new Progress(r.progressTranscript(), r.progressNotes(), r.progressExtras()),
                new ExtrasStatus(r.flashcardsStatus(), r.quizStatus()));
    }
}
