package com.notetube.cards;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;

public final class CardDtos {
    private CardDtos() {}

    /** "due" is what the frontend uses; the other fields describe the schedule. */
    public record CardView(String id, String front, String back, boolean due, Instant dueAt,
                           int intervalDays, double ease, int reviewCount) {}

    public record CardsResponse(List<CardView> cards) {}

    public record CardResponse(CardView card) {}

    public record DeckView(String noteId, String title, String subject, long total, long due) {}

    public record DecksResponse(List<DeckView> decks) {}

    public record ReviewRequest(@NotBlank(message = "Choose again, good or easy") String grade) {}
}
