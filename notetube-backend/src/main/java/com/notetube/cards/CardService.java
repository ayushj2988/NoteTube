package com.notetube.cards;

import com.notetube.cards.CardDtos.CardView;
import com.notetube.cards.CardDtos.DeckView;
import com.notetube.cards.SpacedRepetition.Grade;
import com.notetube.cards.SpacedRepetition.Schedule;
import com.notetube.common.ApiException;
import com.notetube.common.ErrorCode;
import com.notetube.notes.NoteListRow;
import com.notetube.notes.NoteRepository;
import com.notetube.stats.EventService;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CardService {

    private final CardRepository cards;
    private final NoteRepository notes;
    private final EventService events;
    private final Clock clock;

    public CardService(CardRepository cards, NoteRepository notes, EventService events, Clock clock) {
        this.cards = cards;
        this.notes = notes;
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<DeckView> decks(String userId) {
        List<NoteListRow> rows = notes.flashcardDecks(userId);
        if (rows.isEmpty()) {
            return List.of();
        }
        List<String> ids = rows.stream().map(NoteListRow::id).toList();
        Map<String, Long> totals = toMap(cards.totals(ids));
        Map<String, Long> due = toMap(cards.dueCounts(ids, clock.instant()));
        List<DeckView> out = new ArrayList<>();
        for (NoteListRow r : rows) {
            out.add(new DeckView(r.id(), r.title(), r.subject(), totals.getOrDefault(r.id(), 0L), due.getOrDefault(r.id(), 0L)));
        }
        return out;
    }

    /** Due cards first (oldest due first), then the rest. 404 when the note is not yours or has no cards. */
    @Transactional(readOnly = true)
    public List<CardView> cardsFor(String userId, String noteId) {
        if (!notes.existsByIdAndUserId(noteId, userId)) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        List<Card> list = cards.findByNoteId(noteId);
        if (list.isEmpty()) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        Instant now = clock.instant();
        list.sort(Comparator.comparing((Card c) -> c.dueAt.isAfter(now)).thenComparing(c -> c.dueAt));
        return list.stream().map(c -> view(c, now)).toList();
    }

    @Transactional
    public CardView review(String userId, String cardId, String gradeText) {
        Grade grade = Grade.parse(gradeText);
        if (grade == null) {
            throw new ApiException(ErrorCode.VALIDATION, ErrorCode.VALIDATION.defaultMessage(),
                    Map.of("grade", "Use again, good or easy"));
        }
        Card c = cards.findOwned(cardId, userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        Instant now = clock.instant();
        Schedule next = SpacedRepetition.next(c.ease, c.intervalDays, grade, now);
        c.ease = next.ease();
        c.intervalDays = next.intervalDays();
        c.dueAt = next.dueAt();
        c.reviewCount++;
        cards.save(c);
        events.record(userId, EventService.REVIEW);
        return view(c, now);
    }

    private static CardView view(Card c, Instant now) {
        return new CardView(c.id, c.front, c.back, !c.dueAt.isAfter(now), c.dueAt, c.intervalDays, c.ease, c.reviewCount);
    }

    private static Map<String, Long> toMap(List<Object[]> rows) {
        Map<String, Long> m = new HashMap<>();
        for (Object[] r : rows) {
            m.put((String) r[0], ((Number) r[1]).longValue());
        }
        return m;
    }
}
