package com.notetube.cards;

import com.notetube.cards.CardDtos.CardResponse;
import com.notetube.cards.CardDtos.CardsResponse;
import com.notetube.cards.CardDtos.DecksResponse;
import com.notetube.cards.CardDtos.ReviewRequest;
import com.notetube.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class CardController {

    private final CardService service;

    public CardController(CardService service) {
        this.service = service;
    }

    @GetMapping("/decks")
    public DecksResponse decks(@AuthenticationPrincipal AuthUser user) {
        return new DecksResponse(service.decks(user.id()));
    }

    @GetMapping("/notes/{noteId}/cards")
    public CardsResponse cards(@AuthenticationPrincipal AuthUser user, @PathVariable String noteId) {
        return new CardsResponse(service.cardsFor(user.id(), noteId));
    }

    @PostMapping("/cards/{cardId}/review")
    public CardResponse review(@AuthenticationPrincipal AuthUser user, @PathVariable String cardId,
                               @Valid @RequestBody ReviewRequest req) {
        return new CardResponse(service.review(user.id(), cardId, req.grade()));
    }
}
