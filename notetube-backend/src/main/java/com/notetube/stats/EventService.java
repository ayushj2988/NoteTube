package com.notetube.stats;

import java.time.Clock;
import org.springframework.stereotype.Service;

@Service
public class EventService {
    public static final String REVIEW = "review";
    public static final String QUIZ = "quiz";
    public static final String NOTE = "note";

    private final EventRepository events;
    private final Clock clock;

    public EventService(EventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    public void record(String userId, String kind) {
        events.save(new Event(userId, kind, clock.instant()));
    }
}
