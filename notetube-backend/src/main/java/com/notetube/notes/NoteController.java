package com.notetube.notes;

import com.notetube.notes.NoteDtos.CreateNoteRequest;
import com.notetube.notes.NoteDtos.ExtrasRequest;
import com.notetube.notes.NoteDtos.IdResponse;
import com.notetube.notes.NoteDtos.NoteListResponse;
import com.notetube.notes.NoteDtos.NoteResponse;
import com.notetube.notes.NoteDtos.RetryRequest;
import com.notetube.notes.NoteDtos.UpdateNoteRequest;
import com.notetube.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteService service;

    public NoteController(NoteService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<IdResponse> create(@AuthenticationPrincipal AuthUser user,
                                             @Valid @RequestBody CreateNoteRequest req) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new IdResponse(service.create(user.id(), req)));
    }

    @GetMapping
    public NoteListResponse list(@AuthenticationPrincipal AuthUser user,
                                 @RequestParam(defaultValue = "") String q,
                                 @RequestParam(defaultValue = "") String subject) {
        return new NoteListResponse(service.list(user.id(), q, subject));
    }

    @GetMapping("/{id}")
    public NoteResponse get(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        return new NoteResponse(service.get(user.id(), id));
    }

    @PatchMapping("/{id}")
    public NoteResponse update(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                               @Valid @RequestBody UpdateNoteRequest req) {
        return new NoteResponse(service.update(user.id(), id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        service.delete(user.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<IdResponse> retry(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                                            @RequestBody(required = false) RetryRequest req) {
        String transcript = req == null ? null : req.transcript();
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new IdResponse(service.retry(user.id(), id, transcript)));
    }

    @PostMapping("/{id}/extras")
    public ResponseEntity<IdResponse> extras(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                                             @RequestBody ExtrasRequest req) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new IdResponse(service.requestExtras(user.id(), id, req.flashcards(), req.quiz())));
    }
}
