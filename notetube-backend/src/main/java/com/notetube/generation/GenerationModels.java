package com.notetube.generation;

import java.util.List;

/** Typed shapes of what the AI (or the demo generator) produces. */
public final class GenerationModels {
    private GenerationModels() {}

    public record DefinitionOut(String term, String def) {}

    public record SectionOut(Integer ts, String title, String body) {}

    public record NotesOutput(String title, String subject, String summary, List<String> takeaways,
                              List<DefinitionOut> definitions, List<SectionOut> sections) {}

    public record CardOutput(String front, String back) {}

    public record QuizQuestionOutput(String question, List<String> options, Integer answerIndex,
                                     String explanation, String topic) {}

    /** The saved notes, used to build flashcards and quizzes without touching the transcript again. */
    public record NoteContext(String title, String subject, String summary, List<String> takeaways,
                              List<DefinitionOut> definitions, List<SectionOut> sections) {
        public String asText() {
            StringBuilder sb = new StringBuilder();
            sb.append("Title: ").append(title).append('\n');
            sb.append("Subject: ").append(subject == null ? "" : subject).append('\n');
            sb.append("Summary: ").append(summary == null ? "" : summary).append("\n\nKey takeaways:\n");
            takeaways.forEach(t -> sb.append("- ").append(t).append('\n'));
            sb.append("\nDefinitions:\n");
            definitions.forEach(d -> sb.append("- ").append(d.term()).append(": ").append(d.def()).append('\n'));
            sb.append("\nSections:\n");
            sections.forEach(s -> sb.append("## ").append(s.title()).append('\n').append(s.body()).append("\n\n"));
            return sb.toString();
        }
    }
}
