package com.notetube.cards;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

/**
 * Review scheduling as a small pure class (no Spring, easy to test).
 *  again: interval 0, ease -0.2, due in 10 minutes
 *  good : days = max(1, round(interval * ease)), ease unchanged
 *  easy : days = max(1, round(interval * ease * 1.5)), ease +0.15
 * Ease always stays between 1.3 and 3.0.
 */
public final class SpacedRepetition {
    public static final double INITIAL_EASE = 2.5;
    public static final double MIN_EASE = 1.3;
    public static final double MAX_EASE = 3.0;

    private SpacedRepetition() {}

    public enum Grade {
        AGAIN, GOOD, EASY;

        /** Parses "again" | "good" | "easy" (any case). Returns null for anything else. */
        public static Grade parse(String s) {
            if (s == null) {
                return null;
            }
            try {
                return valueOf(s.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }

    public record Schedule(double ease, int intervalDays, Instant dueAt) {}

    public static Schedule next(double ease, int intervalDays, Grade grade, Instant now) {
        switch (grade) {
            case AGAIN:
                return new Schedule(clamp(ease - 0.2), 0, now.plus(Duration.ofMinutes(10)));
            case GOOD: {
                int days = (int) Math.max(1, Math.round(intervalDays * ease));
                return new Schedule(clamp(ease), days, now.plus(Duration.ofDays(days)));
            }
            case EASY: {
                int days = (int) Math.max(1, Math.round(intervalDays * ease * 1.5));
                return new Schedule(clamp(ease + 0.15), days, now.plus(Duration.ofDays(days)));
            }
            default:
                throw new IllegalArgumentException("Unknown grade");
        }
    }

    private static double clamp(double e) {
        double bounded = Math.max(MIN_EASE, Math.min(MAX_EASE, e));
        return Math.round(bounded * 100.0) / 100.0; // avoid 2.3000000000000003
    }
}
