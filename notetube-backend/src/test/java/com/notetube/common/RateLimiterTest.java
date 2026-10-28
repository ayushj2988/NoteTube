package com.notetube.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T00:00:00Z");

        void advance(Duration d) { now = now.plus(d); }

        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void blocksAfterTheLimitAndReopensWhenTheWindowPasses() {
        MutableClock clock = new MutableClock();
        RateLimiter limiter = new RateLimiter(3, Duration.ofMinutes(1), clock);
        assertThat(limiter.tryAcquire("u")).isZero();
        assertThat(limiter.tryAcquire("u")).isZero();
        assertThat(limiter.tryAcquire("u")).isZero();
        assertThat(limiter.tryAcquire("u")).isPositive();
        assertThat(limiter.tryAcquire("other")).isZero();
        clock.advance(Duration.ofSeconds(61));
        assertThat(limiter.tryAcquire("u")).isZero();
    }

    @Test
    void reportsHowLongToWait() {
        MutableClock clock = new MutableClock();
        RateLimiter limiter = new RateLimiter(1, Duration.ofMinutes(1), clock);
        limiter.tryAcquire("k");
        clock.advance(Duration.ofSeconds(20));
        assertThat(limiter.tryAcquire("k")).isEqualTo(40);
    }
}
