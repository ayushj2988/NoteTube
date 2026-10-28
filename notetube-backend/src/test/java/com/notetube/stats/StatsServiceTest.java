package com.notetube.stats;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StatsServiceTest {
    @Test
    void parsesTimezoneHeaderLeniently() {
        assertThat(StatsService.parseOffset(null)).isZero();
        assertThat(StatsService.parseOffset("330")).isEqualTo(330);
        assertThat(StatsService.parseOffset("-300")).isEqualTo(-300);
        assertThat(StatsService.parseOffset("abc")).isZero();
        assertThat(StatsService.parseOffset("99999")).isEqualTo(840);
    }
}
