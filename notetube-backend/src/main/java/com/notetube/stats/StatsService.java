package com.notetube.stats;

import com.fasterxml.jackson.core.type.TypeReference;
import com.notetube.cards.CardRepository;
import com.notetube.common.JsonCodec;
import com.notetube.quiz.AttemptRepository;
import com.notetube.quiz.QuestionRepository;
import com.notetube.quiz.QuizAttempt;
import com.notetube.quiz.QuizDtos.MistakeView;
import com.notetube.quiz.QuizQuestion;
import com.notetube.stats.StatsDtos.HeatDay;
import com.notetube.stats.StatsDtos.StatsResponse;
import com.notetube.stats.StatsDtos.WeakTopic;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Computes the /stats payload with a handful of aggregate queries (not one query per note or card). */
@Service
public class StatsService {

    private static final int HEATMAP_DAYS = 120;

    private final EventRepository events;
    private final CardRepository cards;
    private final AttemptRepository attempts;
    private final QuestionRepository questions;
    private final JsonCodec json;
    private final Clock clock;

    public StatsService(EventRepository events, CardRepository cards, AttemptRepository attempts,
                        QuestionRepository questions, JsonCodec json, Clock clock) {
        this.events = events;
        this.cards = cards;
        this.attempts = attempts;
        this.questions = questions;
        this.json = json;
        this.clock = clock;
    }

    /** offsetMinutes = minutes to add to UTC to get the user's local time (UTC+5:30 = 330). Null/invalid = UTC. */
    @Transactional(readOnly = true)
    public StatsResponse compute(String userId, String offsetHeader) {
        ZoneOffset zone = ZoneOffset.ofTotalSeconds(parseOffset(offsetHeader) * 60);
        Instant now = clock.instant();
        LocalDate today = now.atZone(zone).toLocalDate();

        // activity: heatmap + streak (streak is counted inside the 120-day window)
        Instant since = today.minusDays(HEATMAP_DAYS - 1).atStartOfDay(zone).toInstant();
        TreeMap<LocalDate, Integer> byDay = new TreeMap<>();
        for (Instant t : events.activitySince(userId, since)) {
            byDay.merge(t.atZone(zone).toLocalDate(), 1, Integer::sum);
        }
        List<HeatDay> heatmap = new ArrayList<>();
        byDay.forEach((d, c) -> heatmap.add(new HeatDay(d.toString(), c)));
        LocalDate d = byDay.containsKey(today) ? today : today.minusDays(1);
        int streak = 0;
        while (byDay.containsKey(d)) {
            streak++;
            d = d.minusDays(1);
        }

        long dueToday = cards.countDueBefore(userId, today.plusDays(1).atStartOfDay(zone).toInstant());

        long taken = attempts.countByUserId(userId);
        List<QuizAttempt> recent = attempts.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 1000));
        int average = 0;
        if (!recent.isEmpty()) {
            double sum = 0;
            for (QuizAttempt a : recent) {
                sum += a.total == 0 ? 0 : 100.0 * a.score / a.total;
            }
            average = (int) Math.round(sum / recent.size());
        }
        return new StatsResponse((int) taken, average, streak, dueToday, heatmap, weakTopics(recent));
    }

    /** miss% = misses / how many times that topic was asked (attempts x questions on that topic). */
    private List<WeakTopic> weakTopics(List<QuizAttempt> recent) {
        if (recent.isEmpty()) {
            return List.of();
        }
        Map<String, Integer> attemptsPerNote = new HashMap<>();
        for (QuizAttempt a : recent) {
            attemptsPerNote.merge(a.noteId, 1, Integer::sum);
        }
        Set<String> noteIds = attemptsPerNote.keySet();
        Map<String, Long> asked = new HashMap<>();
        Map<String, Long> missed = new HashMap<>();

        Map<String, Map<String, Long>> topicsByNote = questions.findByNoteIdIn(noteIds).stream()
                .collect(Collectors.groupingBy((QuizQuestion q) -> q.noteId,
                        Collectors.groupingBy((QuizQuestion q) -> q.topic == null ? "General" : q.topic, Collectors.counting())));
        topicsByNote.forEach((noteId, topics) -> topics.forEach((topic, count) ->
                asked.merge(topic, count * attemptsPerNote.getOrDefault(noteId, 0), Long::sum)));

        for (QuizAttempt a : recent) {
            for (MistakeView m : json.read(a.mistakes, new TypeReference<List<MistakeView>>() {}, List.<MistakeView>of())) {
                missed.merge(m.topic() == null ? "General" : m.topic(), 1L, Long::sum);
            }
        }
        List<WeakTopic> out = new ArrayList<>();
        missed.forEach((topic, misses) -> {
            long total = asked.getOrDefault(topic, 0L);
            if (total > 0) {
                out.add(new WeakTopic(topic, (int) Math.min(100, Math.round(100.0 * misses / total))));
            }
        });
        out.sort(Comparator.comparingInt(WeakTopic::missPercent).reversed().thenComparing(WeakTopic::topic));
        return out.size() > 5 ? new ArrayList<>(out.subList(0, 5)) : out;
    }

    static int parseOffset(String header) {
        if (header == null) {
            return 0;
        }
        try {
            return Math.max(-840, Math.min(840, Integer.parseInt(header.trim())));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
