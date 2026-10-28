package com.notetube.generation;

import com.notetube.generation.GenerationModels.CardOutput;
import com.notetube.generation.GenerationModels.DefinitionOut;
import com.notetube.generation.GenerationModels.NotesOutput;
import com.notetube.generation.GenerationModels.QuizQuestionOutput;
import com.notetube.generation.GenerationModels.SectionOut;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Checks AI output and returns a cleaned copy. Throws InvalidOutputException with a readable reason. */
public final class OutputValidator {
    private OutputValidator() {}

    public static NotesOutput cleanNotes(NotesOutput o) {
        if (o == null) {
            throw bad("the answer was empty");
        }
        String title = required(o.title(), "title", 300);
        String subject = o.subject() == null || o.subject().isBlank() ? "General" : cut(o.subject().trim(), 100);
        String summary = required(o.summary(), "summary", 5000);

        List<String> takeaways = new ArrayList<>();
        if (o.takeaways() != null) {
            for (String t : o.takeaways()) {
                if (t != null && !t.isBlank() && takeaways.size() < 12) {
                    takeaways.add(cut(t.trim(), 500));
                }
            }
        }
        if (takeaways.isEmpty()) {
            throw bad("takeaways must contain at least one item");
        }

        List<DefinitionOut> defs = new ArrayList<>();
        if (o.definitions() != null) {
            for (DefinitionOut d : o.definitions()) {
                if (d != null && d.term() != null && !d.term().isBlank() && d.def() != null && !d.def().isBlank()
                        && defs.size() < 20) {
                    defs.add(new DefinitionOut(cut(d.term().trim(), 200), cut(d.def().trim(), 1000)));
                }
            }
        }

        if (o.sections() == null || o.sections().isEmpty()) {
            throw bad("sections must contain at least one section");
        }
        List<SectionOut> sections = new ArrayList<>();
        for (SectionOut s : o.sections()) {
            if (s == null) {
                throw bad("a section was empty");
            }
            Integer ts = s.ts() != null && s.ts() >= 0 ? s.ts() : null;
            sections.add(new SectionOut(ts, required(s.title(), "section title", 300), required(s.body(), "section body", 20000)));
            if (sections.size() == 40) {
                break;
            }
        }
        return new NotesOutput(title, subject, summary, takeaways, defs, sections);
    }

    public static List<CardOutput> cleanCards(List<CardOutput> in) {
        List<CardOutput> out = new ArrayList<>();
        if (in != null) {
            for (CardOutput c : in) {
                if (c != null && c.front() != null && !c.front().isBlank() && c.back() != null && !c.back().isBlank()
                        && out.size() < 40) {
                    out.add(new CardOutput(cut(c.front().trim(), 1000), cut(c.back().trim(), 2000)));
                }
            }
        }
        if (out.size() < 3) {
            throw bad("cards must contain at least 3 cards with a front and a back");
        }
        return out;
    }

    public static List<QuizQuestionOutput> cleanQuiz(List<QuizQuestionOutput> in) {
        if (in == null || in.size() < 5) {
            throw bad("the quiz must contain between 5 and 10 questions");
        }
        List<QuizQuestionOutput> out = new ArrayList<>();
        for (int i = 0; i < Math.min(in.size(), 10); i++) {
            QuizQuestionOutput q = in.get(i);
            String where = "question " + (i + 1);
            if (q == null) {
                throw bad(where + " was empty");
            }
            String text = required(q.question(), where + " text", 1000);
            if (q.options() == null || q.options().size() < 3 || q.options().size() > 4) {
                throw bad(where + " must have 3 or 4 options");
            }
            List<String> options = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (String opt : q.options()) {
                if (opt == null || opt.isBlank()) {
                    throw bad(where + " has an empty option");
                }
                if (!seen.add(opt.trim().toLowerCase(Locale.ROOT))) {
                    throw bad(where + " has duplicate options");
                }
                options.add(cut(opt.trim(), 500));
            }
            if (q.answerIndex() == null || q.answerIndex() < 0 || q.answerIndex() >= options.size()) {
                throw bad(where + " has an answerIndex outside its options");
            }
            String explanation = q.explanation() == null ? "" : cut(q.explanation().trim(), 2000);
            String topic = q.topic() == null || q.topic().isBlank() ? "General" : cut(q.topic().trim(), 200);
            out.add(new QuizQuestionOutput(text, options, q.answerIndex(), explanation, topic));
        }
        return out;
    }

    private static String required(String s, String name, int max) {
        if (s == null || s.isBlank()) {
            throw bad(name + " is missing");
        }
        return cut(s.trim(), max);
    }

    private static String cut(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static InvalidOutputException bad(String why) {
        return new InvalidOutputException(why);
    }
}
