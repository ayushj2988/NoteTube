package com.notetube.generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.notetube.generation.GenerationModels.CardOutput;
import com.notetube.generation.GenerationModels.DefinitionOut;
import com.notetube.generation.GenerationModels.NotesOutput;
import com.notetube.generation.GenerationModels.QuizQuestionOutput;
import com.notetube.generation.GenerationModels.SectionOut;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class OutputValidatorTest {

    private static NotesOutput notes(List<SectionOut> sections) {
        return new NotesOutput("T", "CS", "Summary", List.of("a"), List.of(new DefinitionOut("x", "y")), sections);
    }

    private static QuizQuestionOutput q(int answer, String... options) {
        return new QuizQuestionOutput("Q?", List.of(options), answer, "because", "Topic");
    }

    private static List<QuizQuestionOutput> five(QuizQuestionOutput each) {
        List<QuizQuestionOutput> l = new ArrayList<>();
        for (int i = 0; i < 5; i++) l.add(each);
        return l;
    }

    @Test
    void acceptsValidNotesAndDropsNegativeTimestamps() {
        NotesOutput out = OutputValidator.cleanNotes(notes(List.of(new SectionOut(-5, "S", "Body"))));
        assertThat(out.sections().get(0).ts()).isNull();
    }

    @Test
    void rejectsNotesWithoutSectionsOrSummary() {
        assertThatThrownBy(() -> OutputValidator.cleanNotes(notes(List.of()))).isInstanceOf(InvalidOutputException.class);
        NotesOutput noSummary = new NotesOutput("T", "CS", " ", List.of("a"), List.of(), List.of(new SectionOut(null, "S", "B")));
        assertThatThrownBy(() -> OutputValidator.cleanNotes(noSummary)).isInstanceOf(InvalidOutputException.class);
    }

    @Test
    void cardsNeedAtLeastThree() {
        assertThatThrownBy(() -> OutputValidator.cleanCards(List.of(new CardOutput("a", "b"))))
                .isInstanceOf(InvalidOutputException.class);
        assertThat(OutputValidator.cleanCards(List.of(new CardOutput("1", "a"), new CardOutput("2", "b"), new CardOutput("3", "c"))))
                .hasSize(3);
    }

    @Test
    void quizNeedsFiveToTenQuestionsWithValidOptions() {
        assertThat(OutputValidator.cleanQuiz(five(q(1, "A", "B", "C")))).hasSize(5);
        assertThatThrownBy(() -> OutputValidator.cleanQuiz(five(q(1, "A", "B", "C")).subList(0, 4)))
                .isInstanceOf(InvalidOutputException.class);
        assertThatThrownBy(() -> OutputValidator.cleanQuiz(five(q(3, "A", "B", "C"))))
                .isInstanceOf(InvalidOutputException.class).hasMessageContaining("answerIndex");
        assertThatThrownBy(() -> OutputValidator.cleanQuiz(five(q(0, "A", "B"))))
                .isInstanceOf(InvalidOutputException.class);
        assertThatThrownBy(() -> OutputValidator.cleanQuiz(five(q(0, "A", "a", "C"))))
                .isInstanceOf(InvalidOutputException.class).hasMessageContaining("duplicate");
    }

    @Test
    void quizIsTruncatedToTenQuestions() {
        List<QuizQuestionOutput> twelve = new ArrayList<>();
        for (int i = 0; i < 12; i++) twelve.add(q(0, "A", "B", "C"));
        assertThat(OutputValidator.cleanQuiz(twelve)).hasSize(10);
    }
}
