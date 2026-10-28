package com.notetube.generation;

import com.notetube.common.JsonCodec;
import com.notetube.config.AppProperties;
import com.notetube.generation.GenerationModels.NoteContext;
import com.notetube.generation.GenerationModels.NotesOutput;
import com.notetube.notes.Note;
import com.notetube.notes.NoteMapper;
import com.notetube.notes.NoteStatus;
import com.notetube.notes.TranscriptText;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.IntConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * The generation pipeline. Runs on the bounded "generationExecutor" pool (WORKER_CONCURRENCY threads).
 *
 *  1. notes phase (only while the note is queued/processing):
 *       duration check -> resolve transcript (pasted/saved, else Gemini video input) -> length check
 *       -> generate -> save atomically -> status "ready"
 *  2. extras phase (only for extras whose status is "processing"): flashcards and/or quiz are built
 *     from the SAVED notes, never from the transcript.
 *
 * All state lives in the database, so a restart can resume any unfinished note (see RecoveryRunner).
 */
@Component
public class GenerationWorker {

    private static final Logger log = LoggerFactory.getLogger(GenerationWorker.class);
    private static final int MIN_WORDS = 200;

    private final NoteStateService state;
    private final NoteGenerator generator;
    private final NoteMapper mapper;
    private final AppProperties props;
    private final Set<String> running = ConcurrentHashMap.newKeySet();

    public GenerationWorker(NoteStateService state, NoteGenerator generator, NoteMapper mapper, AppProperties props,
                            JsonCodec json) {
        this.state = state;
        this.generator = generator;
        this.mapper = mapper;
        this.props = props;
    }

    @Async("generationExecutor")
    public void run(String noteId) {
        if (!running.add(noteId)) {
            return; // already being processed; it re-checks for newly requested extras before it exits
        }
        try {
            for (int round = 0; round < 3; round++) {
                runOnce(noteId);
                if (!state.hasPendingExtras(noteId)) {
                    break;
                }
            }
        } catch (RuntimeException e) {
            log.error("Generation crashed for note {}", noteId, e);
            state.fail(noteId, "UNKNOWN", "Something went wrong while generating this note.");
        } finally {
            running.remove(noteId);
        }
    }

    private void runOnce(String noteId) {
        Optional<Note> begun = state.begin(noteId);
        if (begun.isEmpty()) {
            return;
        }
        Note n = begun.get();
        if (NoteStatus.FAILED.equals(n.status)) {
            return;
        }
        if (!NoteStatus.READY.equals(n.status)) {
            try {
                notesPhase(n);
            } catch (GenerationException e) {
                log.info("Note {} failed: {}", noteId, e.code());
                state.fail(noteId, e.code(), e.getMessage());
                return;
            } catch (RuntimeException e) {
                log.error("Note {} failed unexpectedly", noteId, e);
                state.fail(noteId, "UNKNOWN", "Something went wrong while generating this note.");
                return;
            }
        }
        extrasPhase(noteId);
    }

    private void notesPhase(Note n) {
        String id = n.id;
        if (n.durationSec != null && n.durationSec > (long) props.maxVideoMinutes() * 60) {
            throw new GenerationException("VIDEO_TOO_LONG",
                    "This video is longer than the " + props.maxVideoMinutes() + "-minute limit.");
        }
        String transcript = n.transcript == null ? "" : n.transcript;
        boolean useVideo = false;
        if (transcript.isBlank()) {
            if (n.youtubeId == null || n.url == null) {
                throw new GenerationException("NO_CAPTIONS", "There is no transcript to read. Paste one to continue.");
            }
            useVideo = true;
        } else if (TranscriptText.wordCount(transcript) < MIN_WORDS) {
            throw new GenerationException("TRANSCRIPT_TOO_SHORT",
                    "That transcript is too short (under " + MIN_WORDS + " words). Paste a longer one.");
        }
        state.setProgress(id, 100, 10, null);

        NotesOutput out;
        if (useVideo) {
            out = generator.notesFromVideo(n.url, n.title);
        } else {
            IntConsumer onProgress = pct -> state.setProgress(id, null, pct, null);
            out = generator.notesFromTranscript(transcript, n.title, onProgress);
        }
        state.saveNotes(id, out, useVideo);
    }

    private void extrasPhase(String noteId) {
        Optional<Note> loaded = state.load(noteId);
        if (loaded.isEmpty() || !NoteStatus.READY.equals(loaded.get().status)) {
            return;
        }
        Note n = loaded.get();
        boolean flashcards = NoteStatus.PROCESSING.equals(n.flashcardsStatus);
        boolean quiz = NoteStatus.PROCESSING.equals(n.quizStatus);
        if (!flashcards && !quiz) {
            return;
        }
        NoteContext ctx = new NoteContext(n.title, n.subject, n.summary, mapper.takeaways(n),
                mapper.definitions(n).stream().map(d -> new GenerationModels.DefinitionOut(d.term(), d.def())).toList(),
                mapper.sections(n).stream().map(s -> new GenerationModels.SectionOut(s.ts(), s.title(), s.body())).toList());
        int total = (flashcards ? 1 : 0) + (quiz ? 1 : 0);
        int done = 0;
        state.setProgress(noteId, null, null, 5);
        if (flashcards) {
            try {
                state.saveCards(noteId, OutputValidator.cleanCards(generator.flashcards(ctx)));
            } catch (RuntimeException e) {
                log.info("Flashcards failed for note {} ({})", noteId, e.getClass().getSimpleName());
                state.setExtraStatus(noteId, NoteStateService.FLASHCARDS, NoteStatus.FAILED);
            }
            state.setProgress(noteId, null, null, ++done * 100 / total);
        }
        if (quiz) {
            try {
                state.saveQuiz(noteId, OutputValidator.cleanQuiz(generator.quiz(ctx)));
            } catch (RuntimeException e) {
                log.info("Quiz failed for note {} ({})", noteId, e.getClass().getSimpleName());
                state.setExtraStatus(noteId, NoteStateService.QUIZ, NoteStatus.FAILED);
            }
            state.setProgress(noteId, null, null, ++done * 100 / total);
        }
    }
}
