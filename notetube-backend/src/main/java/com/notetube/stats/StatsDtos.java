package com.notetube.stats;

import java.util.List;

public final class StatsDtos {
    private StatsDtos() {}

    public record HeatDay(String date, int count) {}

    public record WeakTopic(String topic, int missPercent) {}

    public record StatsResponse(int quizzesTaken, int averageScore, int streakDays, long dueToday,
                                List<HeatDay> heatmap, List<WeakTopic> weakTopics) {}
}
