package com.notetube.quiz;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class QuizDtos {
    private QuizDtos() {}

    public record QuestionView(String id, String question, List<String> options, int answerIndex, String explanation) {}

    public record QuestionsResponse(List<QuestionView> questions) {}

    public record AnswerIn(@NotBlank(message = "Missing questionId") String questionId,
                           @NotNull(message = "Missing picked option") Integer picked) {}

    public record AttemptRequest(@NotNull(message = "Send your answers") @Size(max = 100, message = "Too many answers")
                                 List<@Valid AnswerIn> answers) {}

    public record MistakeView(String questionId, String topic) {}

    public record AttemptView(String id, int score, int total, List<MistakeView> mistakes) {}

    public record AttemptResponse(AttemptView attempt) {}

    public record LastScore(int score, int total) {}

    public record QuizListItem(String noteId, String title, String subject, long total, LastScore lastScore) {}

    public record QuizzesResponse(List<QuizListItem> quizzes) {}
}
