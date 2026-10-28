package com.notetube.quiz;

import com.notetube.quiz.QuizDtos.AttemptRequest;
import com.notetube.quiz.QuizDtos.AttemptResponse;
import com.notetube.quiz.QuizDtos.QuestionsResponse;
import com.notetube.quiz.QuizDtos.QuizzesResponse;
import com.notetube.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class QuizController {

    private final QuizService service;

    public QuizController(QuizService service) {
        this.service = service;
    }

    @GetMapping("/quizzes")
    public QuizzesResponse quizzes(@AuthenticationPrincipal AuthUser user) {
        return new QuizzesResponse(service.list(user.id()));
    }

    @GetMapping("/notes/{noteId}/quiz")
    public QuestionsResponse quiz(@AuthenticationPrincipal AuthUser user, @PathVariable String noteId) {
        return new QuestionsResponse(service.questionsFor(user.id(), noteId));
    }

    @PostMapping("/notes/{noteId}/quiz/attempts")
    public ResponseEntity<AttemptResponse> submit(@AuthenticationPrincipal AuthUser user, @PathVariable String noteId,
                                                  @Valid @RequestBody AttemptRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AttemptResponse(service.submit(user.id(), noteId, req.answers())));
    }
}
