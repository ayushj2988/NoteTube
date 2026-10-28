package com.notetube.common;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window limiter: at most "limit" hits per key inside "window".
 * Single instance only: state resets on restart and is not shared between servers.
 */
public class RateLimiter {

    private final int limit;
    private final long windowMs;
    private final Clock clock;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public RateLimiter(int limit, Duration window, Clock clock) {
        this.limit = limit;
        this.windowMs = window.toMillis();
        this.clock = clock;
    }

    /** Returns 0 if the hit is allowed (and counted), otherwise the number of seconds to wait. */
    public long tryAcquire(String key) {
        if (limit <= 0) {
            return 0;
        }
        long now = clock.millis();
        if (hits.size() > 5000) {
            prune(now);
        }
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() >= windowMs) {
                q.pollFirst();
            }
            if (q.size() >= limit) {
                long waitMs = q.peekFirst() + windowMs - now;
                return Math.max(1, (waitMs + 999) / 1000);
            }
            q.addLast(now);
            return 0;
        }
    }

    private void prune(long now) {
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                Long last = e.getValue().peekLast();
                return last == null || now - last >= windowMs;
            }
        });
    }
}
