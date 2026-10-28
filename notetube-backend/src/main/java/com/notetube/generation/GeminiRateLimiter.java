package com.notetube.generation;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;

/** Shared limit on Gemini requests per minute (GEMINI_MAX_RPM). acquire() waits for a free slot. */
public class GeminiRateLimiter {

    private final int rpm;
    private final Clock clock;
    private final Deque<Long> times = new ArrayDeque<>();

    public GeminiRateLimiter(int rpm, Clock clock) {
        this.rpm = rpm;
        this.clock = clock;
    }

    public void acquire() {
        if (rpm <= 0) {
            return;
        }
        while (true) {
            long waitMs;
            synchronized (this) {
                long now = clock.millis();
                while (!times.isEmpty() && now - times.peekFirst() >= 60_000L) {
                    times.pollFirst();
                }
                if (times.size() < rpm) {
                    times.addLast(now);
                    return;
                }
                waitMs = times.peekFirst() + 60_000L - now;
            }
            try {
                Thread.sleep(Math.max(50L, waitMs));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new GenerationException("UNKNOWN", "Generation was interrupted.");
            }
        }
    }
}
