package com.notetube.quiz;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "quiz_questions")
public class QuizQuestion {
    @Id
    public String id;
    public String noteId;
    public int sortOrder;
    public String question;
    public String options; // JSON array of strings
    public int answerIndex;
    public String explanation;
    public String topic;

    protected QuizQuestion() {}

    public QuizQuestion(String id, String noteId, int sortOrder, String question, String options,
                        int answerIndex, String explanation, String topic) {
        this.id = id;
        this.noteId = noteId;
        this.sortOrder = sortOrder;
        this.question = question;
        this.options = options;
        this.answerIndex = answerIndex;
        this.explanation = explanation;
        this.topic = topic;
    }
}
