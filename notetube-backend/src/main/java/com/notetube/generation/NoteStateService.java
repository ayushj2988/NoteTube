package com.notetube.generation;

import com.notetube.cards.Card;
import com.notetube.cards.CardRepository;
import com.notetube.common.Ids;
import com.notetube.common.JsonCodec;
import com.notetube.generation.GenerationModels.CardOutput;
import com.notetube.generation.GenerationModels.DefinitionOut;
import com.notetube.generation.GenerationModels.NotesOutput;
import com.notetube.generation.GenerationModels.QuizQuestionOutput;
import com.notetube.generation.GenerationModels.SectionOut;
import com.notetube.notes.Note;
import com.notetube.notes.NoteDtos.Definition;
import com.notetube.notes.NoteDtos.Section;
import com.notetube.notes.NoteRepository;
import com.notetube.notes.NoteStatus;
import com.notetube.quiz.QuestionRepository;
import com.notetube.quiz.QuizQuestion;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every method is its own short transaction, so progress updates are committed immediately and the
 * frontend sees them while the worker is still running. Saving results replaces old data in one
 * transaction, which keeps a resumed or repeated job from creating duplicate cards or questions.
 */
@Service
public class NoteStateService {

    public static final String FLASHCARDS = "flashcards";
    public static final String QUIZ = "quiz";

    private final NoteRepository notes;
    private final CardRepository cards;
    private final QuestionRepository questions;
    private final JsonCodec json;
    private final Clock clock;

    public NoteStateService(NoteRepository notes, CardRepository cards, QuestionRepository questions,
                            JsonCodec json, Clock clock) {
        this.notes = notes;
        this.cards = cards;
        this.questions = questions;
        this.json = json;
        this.clock = clock;
    }

    /** queued -> processing. Returns the note as it is now (processing notes are resumed as they are). */
    @Transactional
    public Optional<Note> begin(String id) {
        Optional<Note> found = notes.findById(id);
        found.ifPresent(n -> {
            if (NoteStatus.QUEUED.equals(n.status)) {
                n.status = NoteStatus.PROCESSING;
                n.errorCode = null;
                n.errorMessage = null;
                n.updatedAt = clock.instant();
            }
        });
        return found;
    }

    @Transactional(readOnly = true)
    public Optional<Note> load(String id) {
        return notes.findById(id);
    }

    @Transactional
    public void setProgress(String id, Integer transcript, Integer notesPct, Integer extras) {
        notes.findById(id).ifPresent(n -> {
            if (transcript != null) n.progressTranscript = clamp(transcript);
            if (notesPct != null) n.progressNotes = clamp(notesPct);
            if (extras != null) n.progressExtras = clamp(extras);
            n.updatedAt = clock.instant();
        });
    }

    @Transactional
    public void saveNotes(String id, NotesOutput out, boolean hasVideo) {
        Optional<Note> found = notes.findById(id);
        if (found.isEmpty()) {
            return; // deleted while generating
        }
        Note n = found.get();
        if (n.title == null || Note.PLACEHOLDER_TITLES.contains(n.title)) {
            n.title = out.title();
        }
        if (n.subject == null || n.subject.isBlank()) {
            n.subject = out.subject();
        }
        n.summary = out.summary();
        n.takeaways = json.write(out.takeaways());
        List<Definition> defs = new ArrayList<>();
        for (DefinitionOut d : out.definitions()) {
            defs.add(new Definition(d.term(), d.def()));
        }
        n.definitions = json.write(defs);
        List<Section> sections = new ArrayList<>();
        for (int i = 0; i < out.sections().size(); i++) {
            SectionOut s = out.sections().get(i);
            sections.add(new Section("s" + (i + 1), hasVideo ? s.ts() : null, s.title(), s.body()));
        }
        n.sections = json.write(sections);
        n.progressTranscript = 100;
        n.progressNotes = 100;
        n.status = NoteStatus.READY;
        n.errorCode = null;
        n.errorMessage = null;
        n.updatedAt = clock.instant();
    }

    @Transactional
    public void fail(String id, String code, String message) {
        notes.findById(id).ifPresent(n -> {
            n.status = NoteStatus.FAILED;
            n.errorCode = code;
            n.errorMessage = message == null ? null : (message.length() > 500 ? message.substring(0, 500) : message);
            if (NoteStatus.PROCESSING.equals(n.flashcardsStatus)) n.flashcardsStatus = NoteStatus.NONE;
            if (NoteStatus.PROCESSING.equals(n.quizStatus)) n.quizStatus = NoteStatus.NONE;
            n.updatedAt = clock.instant();
        });
    }

    @Transactional
    public void setExtraStatus(String id, String kind, String status) {
        notes.findById(id).ifPresent(n -> {
            if (FLASHCARDS.equals(kind)) n.flashcardsStatus = status;
            if (QUIZ.equals(kind)) n.quizStatus = status;
            n.updatedAt = clock.instant();
        });
    }

    @Transactional
    public void saveCards(String id, List<CardOutput> out) {
        Optional<Note> found = notes.findById(id);
        if (found.isEmpty()) {
            return;
        }
        cards.deleteByNoteId(id);
        Instant now = clock.instant();
        List<Card> fresh = new ArrayList<>();
        for (CardOutput c : out) {
            fresh.add(new Card(Ids.newId("c_"), id, c.front(), c.back(), now));
        }
        cards.saveAll(fresh);
        found.get().flashcardsStatus = NoteStatus.READY;
        found.get().updatedAt = now;
    }

    @Transactional
    public void saveQuiz(String id, List<QuizQuestionOutput> out) {
        Optional<Note> found = notes.findById(id);
        if (found.isEmpty()) {
            return;
        }
        questions.deleteByNoteId(id);
        List<QuizQuestion> fresh = new ArrayList<>();
        for (int i = 0; i < out.size(); i++) {
            QuizQuestionOutput q = out.get(i);
            fresh.add(new QuizQuestion(Ids.newId("q_"), id, i, q.question(), json.write(q.options()),
                    q.answerIndex(), q.explanation(), q.topic()));
        }
        questions.saveAll(fresh);
        found.get().quizStatus = NoteStatus.READY;
        found.get().updatedAt = clock.instant();
    }

    @Transactional(readOnly = true)
    public boolean hasPendingExtras(String id) {
        return notes.findById(id)
                .map(n -> NoteStatus.READY.equals(n.status)
                        && (NoteStatus.PROCESSING.equals(n.flashcardsStatus) || NoteStatus.PROCESSING.equals(n.quizStatus)))
                .orElse(false);
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
