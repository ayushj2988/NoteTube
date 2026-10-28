package com.notetube.quiz;

import com.fasterxml.jackson.core.type.TypeReference;
import com.notetube.common.ApiException;
import com.notetube.common.ErrorCode;
import com.notetube.common.Ids;
import com.notetube.common.JsonCodec;
import com.notetube.notes.NoteListRow;
import com.notetube.notes.NoteRepository;
import com.notetube.quiz.QuizDtos.AnswerIn;
import com.notetube.quiz.QuizDtos.AttemptView;
import com.notetube.quiz.QuizDtos.LastScore;
import com.notetube.quiz.QuizDtos.MistakeView;
import com.notetube.quiz.QuizDtos.QuestionView;
import com.notetube.quiz.QuizDtos.QuizListItem;
import com.notetube.stats.EventService;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizService {

    private final NoteRepository notes;
    private final QuestionRepository questions;
    private final AttemptRepository attempts;
    private final EventService events;
    private final JsonCodec json;
    private final Clock clock;

    public QuizService(NoteRepository notes, QuestionRepository questions, AttemptRepository attempts,
                       EventService events, JsonCodec json, Clock clock) {
        this.notes = notes;
        this.questions = questions;
        this.attempts = attempts;
        this.events = events;
        this.json = json;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<QuizListItem> list(String userId) {
        List<NoteListRow> rows = notes.quizNotes(userId);
        if (rows.isEmpty()) {
            return List.of();
        }
        List<String> ids = rows.stream().map(NoteListRow::id).toList();
        Map<String, Long> totals = new HashMap<>();
        for (Object[] r : questions.totals(ids)) {
            totals.put((String) r[0], ((Number) r[1]).longValue());
        }
        Map<String, QuizAttempt> last = new HashMap<>();
        for (QuizAttempt a : attempts.recentForNotes(userId, ids)) { // newest first
            last.putIfAbsent(a.noteId, a);
        }
        List<QuizListItem> out = new ArrayList<>();
        for (NoteListRow r : rows) {
            QuizAttempt a = last.get(r.id());
            out.add(new QuizListItem(r.id(), r.title(), r.subject(), totals.getOrDefault(r.id(), 0L),
                    a == null ? null : new LastScore(a.score, a.total)));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<QuestionView> questionsFor(String userId, String noteId) {
        return load(userId, noteId).stream()
                .map(q -> new QuestionView(q.id, q.question, options(q), q.answerIndex, q.explanation == null ? "" : q.explanation))
                .toList();
    }

    /** The score is computed here from the stored answers; nothing the browser claims about its score is used. */
    @Transactional
    public AttemptView submit(String userId, String noteId, List<AnswerIn> answers) {
        List<QuizQuestion> qs = load(userId, noteId);
        Map<String, Integer> picked = new HashMap<>();
        for (AnswerIn a : answers) {
            picked.putIfAbsent(a.questionId(), a.picked()); // unknown question ids are simply never looked up
        }
        int score = 0;
        List<MistakeView> mistakes = new ArrayList<>();
        for (QuizQuestion q : qs) {
            Integer p = picked.get(q.id);
            if (p != null && p == q.answerIndex) {
                score++;
            } else {
                mistakes.add(new MistakeView(q.id, q.topic == null ? "General" : q.topic)); // wrong or unanswered
            }
        }
        QuizAttempt attempt = new QuizAttempt(Ids.newId("a_"), noteId, userId, score, qs.size(),
                json.write(mistakes), clock.instant());
        attempts.save(attempt);
        events.record(userId, EventService.QUIZ);
        return new AttemptView(attempt.id, score, qs.size(), mistakes);
    }

    private List<QuizQuestion> load(String userId, String noteId) {
        if (!notes.existsByIdAndUserId(noteId, userId)) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        List<QuizQuestion> qs = questions.findByNoteIdOrderBySortOrder(noteId);
        if (qs.isEmpty()) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        return qs;
    }

    private List<String> options(QuizQuestion q) {
        return json.read(q.options, new TypeReference<List<String>>() {}, List.of());
    }
}
