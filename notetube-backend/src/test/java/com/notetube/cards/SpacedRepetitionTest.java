package com.notetube.cards;

import static org.assertj.core.api.Assertions.assertThat;

import com.notetube.cards.SpacedRepetition.Grade;
import com.notetube.cards.SpacedRepetition.Schedule;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class SpacedRepetitionTest {

    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    @Test
    void againResetsIntervalLowersEaseAndIsDueInTenMinutes() {
        Schedule s = SpacedRepetition.next(2.5, 10, Grade.AGAIN, NOW);
        assertThat(s.intervalDays()).isZero();
        assertThat(s.ease()).isEqualTo(2.3);
        assertThat(s.dueAt()).isEqualTo(NOW.plus(Duration.ofMinutes(10)));
    }

    @Test
    void goodMultipliesIntervalByEaseWithMinimumOneDay() {
        assertThat(SpacedRepetition.next(2.5, 0, Grade.GOOD, NOW).intervalDays()).isEqualTo(1);
        Schedule s = SpacedRepetition.next(2.5, 4, Grade.GOOD, NOW);
        assertThat(s.intervalDays()).isEqualTo(10);
        assertThat(s.ease()).isEqualTo(2.5);
        assertThat(s.dueAt()).isEqualTo(NOW.plus(Duration.ofDays(10)));
    }

    @Test
    void easyUsesBonusMultiplierAndRaisesEase() {
        Schedule s = SpacedRepetition.next(2.5, 4, Grade.EASY, NOW);
        assertThat(s.intervalDays()).isEqualTo(15);
        assertThat(s.ease()).isEqualTo(2.65);
        assertThat(SpacedRepetition.next(2.5, 0, Grade.EASY, NOW).intervalDays()).isEqualTo(1);
    }

    @Test
    void easeStaysBetween1_3And3_0() {
        assertThat(SpacedRepetition.next(2.95, 4, Grade.EASY, NOW).ease()).isEqualTo(3.0);
        assertThat(SpacedRepetition.next(1.35, 4, Grade.AGAIN, NOW).ease()).isEqualTo(1.3);
    }

    @Test
    void parsesGradesCaseInsensitively() {
        assertThat(Grade.parse("Good")).isEqualTo(Grade.GOOD);
        assertThat(Grade.parse("meh")).isNull();
        assertThat(Grade.parse(null)).isNull();
    }
}
