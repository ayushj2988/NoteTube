package com.notetube.notes;

import com.notetube.common.ApiException;
import com.notetube.common.ErrorCode;
import com.notetube.common.Ids;
import com.notetube.common.JsonCodec;
import com.notetube.common.RateLimits;
import com.notetube.config.AppProperties;
import com.notetube.generation.GenerationQueue;
import com.notetube.generation.VideoMetadata;
import com.notetube.generation.VideoMetadataClient;
import com.notetube.notes.NoteDtos.CreateNoteRequest;
import com.notetube.notes.NoteDtos.NoteListItem;
import com.notetube.notes.NoteDtos.NoteView;
import com.notetube.notes.NoteDtos.Section;
import com.notetube.notes.NoteDtos.SectionInput;
import com.notetube.notes.NoteDtos.UpdateNoteRequest;
import com.notetube.stats.EventService;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService {

    private final NoteRepository notes;
    private final NoteMapper mapper;
    private final JsonCodec json;
    private final VideoMetadataClient metadata;
    private final GenerationQueue queue;
    private final EventService events;
    private final RateLimits limits;
    private final AppProperties props;
    private final Clock clock;

    public NoteService(NoteRepository notes, NoteMapper mapper, JsonCodec json, VideoMetadataClient metadata,
                       GenerationQueue queue, EventService events, RateLimits limits, AppProperties props, Clock clock) {
        this.notes = notes;
        this.mapper = mapper;
        this.json = json;
        this.metadata = metadata;
        this.queue = queue;
        this.events = events;
        this.limits = limits;
        this.props = props;
        this.clock = clock;
    }

    /** Not @Transactional on purpose: the note is committed before the worker is started. */
    public String create(String userId, CreateNoteRequest req) {
        String url = req.url() == null ? "" : req.url().trim();
        String transcript = TranscriptText.normalize(req.transcript());
        if (url.isEmpty() && transcript.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION, ErrorCode.VALIDATION.defaultMessage(),
                    Map.of("url", "Paste a YouTube link or a transcript"));
        }
        if (transcript.length() > TranscriptText.MAX_CHARS) {
            throw new ApiException(ErrorCode.PAYLOAD_TOO_LARGE, "That transcript is too long. Try a shorter one.");
        }
        String youtubeId = null;
        if (!url.isEmpty()) {
            youtubeId = YouTubeUrls.extractId(url, false).orElse(null);
            if (youtubeId == null && props.isDemoMode() && url.toLowerCase(Locale.ROOT).contains("nocaptions")) {
                youtubeId = YouTubeUrls.extractId(url, true).orElse(null); // demo-only test links
            }
            if (youtubeId == null) {
                throw new ApiException(ErrorCode.INVALID_URL);
            }
        }

        Instant now = clock.instant();
        long today = notes.countByUserIdAndCreatedAtGreaterThanEqual(userId, now.truncatedTo(ChronoUnit.DAYS));
        if (today >= props.dailyGenerationLimit()) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "You've reached today's limit of " + props.dailyGenerationLimit() + " notes. Try again tomorrow.");
        }
        RateLimits.enforce(limits.noteCreate, userId, "note requests");

        VideoMetadata md = youtubeId == null ? null : metadata.fetch(youtubeId); // may throw 400 INVALID_URL

        Note n = new Note(Ids.newId("n_"), userId, now);
        n.url = url.isEmpty() ? null : url;
        n.youtubeId = youtubeId;
        n.transcript = transcript.isEmpty() ? null : transcript;
        n.title = md != null && md.title() != null ? cut(md.title(), 300) : (youtubeId != null ? "YouTube video" : "Pasted transcript");
        if (md != null) {
            n.channel = cut(md.channel(), 200);
            n.thumbnailUrl = cut(md.thumbnailUrl(), 500);
            n.durationSec = md.durationSec();
        }
        boolean fc = req.extras() != null && req.extras().flashcards();
        boolean quiz = req.extras() != null && req.extras().quiz();
        n.wantFlashcards = fc;
        n.wantQuiz = quiz;
        n.flashcardsStatus = fc ? NoteStatus.PROCESSING : NoteStatus.NONE;
        n.quizStatus = quiz ? NoteStatus.PROCESSING : NoteStatus.NONE;
        notes.save(n);
        events.record(userId, EventService.NOTE);
        queue.enqueue(n.id);
        return n.id;
    }

    @Transactional(readOnly = true)
    public List<NoteListItem> list(String userId, String q, String subject) {
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (query.length() > 200) {
            query = query.substring(0, 200);
        }
        String subj = subject == null ? "" : subject.trim();
        return notes.search(userId, subj, query, "%" + query + "%").stream().map(mapper::toListItem).toList();
    }

    @Transactional(readOnly = true)
    public NoteView get(String userId, String id) {
        return mapper.toView(require(userId, id));
    }

    @Transactional
    public NoteView update(String userId, String id, UpdateNoteRequest req) {
        Note n = require(userId, id);
        if (req.title() != null) {
            n.title = req.title();
        }
        if (req.subject() != null) {
            n.subject = req.subject();
        }
        if (req.summary() != null) {
            n.summary = req.summary();
        }
        if (req.sections() != null) {
            n.sections = json.write(cleanSections(req.sections()));
        }
        n.updatedAt = clock.instant();
        return mapper.toView(notes.save(n));
    }

    @Transactional
    public void delete(String userId, String id) {
        notes.delete(require(userId, id)); // cards, questions and attempts go via ON DELETE CASCADE
    }

    /** Only failed notes can be retried. A pasted transcript replaces whatever was saved. */
    public String retry(String userId, String id, String pastedTranscript) {
        Note n = require(userId, id);
        if (!NoteStatus.FAILED.equals(n.status)) {
            throw new ApiException(ErrorCode.NOT_READY, "Only notes that failed can be retried.");
        }
        RateLimits.enforce(limits.noteRetry, userId, "retries");
        String t = TranscriptText.normalize(pastedTranscript);
        if (t.length() > TranscriptText.MAX_CHARS) {
            throw new ApiException(ErrorCode.PAYLOAD_TOO_LARGE, "That transcript is too long. Try a shorter one.");
        }
        if (!t.isEmpty()) {
            n.transcript = t;
        }
        n.status = NoteStatus.QUEUED;
        n.errorCode = null;
        n.errorMessage = null;
        n.progressTranscript = 0;
        n.progressNotes = 0;
        n.progressExtras = 0;
        n.flashcardsStatus = n.wantFlashcards ? NoteStatus.PROCESSING : NoteStatus.NONE;
        n.quizStatus = n.wantQuiz ? NoteStatus.PROCESSING : NoteStatus.NONE;
        n.updatedAt = clock.instant();
        notes.save(n);
        queue.enqueue(n.id);
        return n.id;
    }

    /** Builds extras from the saved notes. Never fetches the transcript again. */
    public String requestExtras(String userId, String id, boolean flashcards, boolean quiz) {
        Note n = require(userId, id);
        if (!NoteStatus.READY.equals(n.status)) {
            throw new ApiException(ErrorCode.NOT_READY);
        }
        RateLimits.enforce(limits.extras, userId, "extras requests");
        boolean changed = false;
        if (flashcards && canStart(n.flashcardsStatus)) {
            n.flashcardsStatus = NoteStatus.PROCESSING;
            n.wantFlashcards = true;
            changed = true;
        }
        if (quiz && canStart(n.quizStatus)) {
            n.quizStatus = NoteStatus.PROCESSING;
            n.wantQuiz = true;
            changed = true;
        }
        if (changed) {
            n.progressExtras = 0;
            n.updatedAt = clock.instant();
            notes.save(n);
            queue.enqueue(n.id);
        }
        return n.id;
    }

    private static boolean canStart(String extraStatus) {
        return NoteStatus.NONE.equals(extraStatus) || NoteStatus.FAILED.equals(extraStatus);
    }

    private Note require(String userId, String id) {
        // 404 (not 403) for someone else's note, as the contract requires.
        return notes.findByIdAndUserId(id, userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    private List<Section> cleanSections(List<SectionInput> in) {
        List<Section> out = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (int i = 0; i < in.size(); i++) {
            SectionInput s = in.get(i);
            if (s.ts() != null && s.ts() < 0) {
                throw new ApiException(ErrorCode.VALIDATION, ErrorCode.VALIDATION.defaultMessage(),
                        Map.of("sections[" + i + "].ts", "Timestamp can't be negative"));
            }
            String sid = s.id() == null ? "" : s.id().trim();
            if (sid.isEmpty() || !used.add(sid)) {
                int k = i + 1;
                while (!used.add("s" + k)) {
                    k++;
                }
                sid = "s" + k;
            }
            out.add(new Section(sid, s.ts(), s.title().trim(), s.body()));
        }
        return out;
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
