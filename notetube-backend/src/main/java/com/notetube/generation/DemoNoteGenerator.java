package com.notetube.generation;

import com.notetube.generation.GenerationModels.CardOutput;
import com.notetube.generation.GenerationModels.DefinitionOut;
import com.notetube.generation.GenerationModels.NoteContext;
import com.notetube.generation.GenerationModels.NotesOutput;
import com.notetube.generation.GenerationModels.QuizQuestionOutput;
import com.notetube.generation.GenerationModels.SectionOut;
import com.notetube.notes.Note;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.IntConsumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Offline generator used when GEMINI_API_KEY is empty (DEMO mode). No network, no cost.
 * Builds realistic-looking notes from the pasted transcript, or sample notes for a video link.
 * A YouTube URL containing "nocaptions" fails with NO_CAPTIONS so the retry flow can be tested.
 */
public class DemoNoteGenerator implements NoteGenerator {

    private static final String[] DISTRACTORS = {
            "It was only mentioned as a side remark and has no practical use.",
            "It contradicts the rest of the lecture.",
            "It only applies to hardware, never to software."
    };

    @Override
    public NotesOutput notesFromTranscript(String transcript, String titleHint, IntConsumer progress) {
        progress.accept(40);
        List<String> sentences = sentences(transcript);
        String title = Note.PLACEHOLDER_TITLES.contains(titleHint) ? "Study notes: " + firstWords(transcript, 6) : titleHint;

        int groups = Math.min(4, Math.max(1, sentences.size() / 3));
        List<SectionOut> sections = new ArrayList<>();
        for (int g = 0; g < groups; g++) {
            int from = g * sentences.size() / groups;
            int to = (g + 1) * sentences.size() / groups;
            List<String> slice = sentences.subList(from, Math.min(to, from + 3));
            String body = String.join(" ", slice);
            sections.add(new SectionOut(null, "Part " + (g + 1) + ": " + firstWords(body, 4), highlight(body)));
        }
        List<String> takeaways = new ArrayList<>();
        for (int i = 0; i < Math.min(5, sentences.size()); i++) {
            takeaways.add(cut(sentences.get(i), 140));
        }
        progress.accept(90);
        return new NotesOutput(title, "General", "[Demo mode] " + cut(String.join(" ", sentences.subList(0, Math.min(2, sentences.size()))), 400),
                takeaways, definitions(sentences), sections);
    }

    @Override
    public NotesOutput notesFromVideo(String videoUrl, String titleHint) {
        if (videoUrl != null && videoUrl.toLowerCase(Locale.ROOT).contains("nocaptions")) {
            throw new GenerationException("NO_CAPTIONS", "This video has no captions we can read. Paste its transcript to continue.");
        }
        String title = Note.PLACEHOLDER_TITLES.contains(titleHint) ? "How hash tables work" : titleHint;
        return new NotesOutput(title, "Computer Science",
                "[Demo mode] A hash table stores key-value pairs by mapping each key to an array index with a hash function, giving near constant-time lookups when collisions are handled well.",
                List.of("A hash function maps a key to an array index.",
                        "Collisions happen when two keys map to the same bucket.",
                        "Chaining and open addressing are the two common ways to resolve collisions.",
                        "Keeping the load factor low keeps operations fast.",
                        "Resizing the table spreads keys over more buckets."),
                List.of(new DefinitionOut("Bucket", "One slot of the underlying array that can hold one or more entries."),
                        new DefinitionOut("Load factor", "The number of stored entries divided by the number of buckets."),
                        new DefinitionOut("Collision", "Two different keys that hash to the same bucket.")),
                List.of(new SectionOut(0, "What is a hash table?", "A hash table maps keys to values using an array and a ==hash function== that turns a key into an index."),
                        new SectionOut(134, "Hash function", "A good hash function spreads keys evenly and maps a key to an index in ==constant time==."),
                        new SectionOut(410, "Handling collisions", "When two keys land in the same bucket you can keep a list per bucket (chaining) or probe for the next free slot (==open addressing==)."),
                        new SectionOut(720, "Load factor and resizing", "As the table fills up, collisions get more likely. Growing the array when the ==load factor== passes a threshold keeps lookups fast.")));
    }

    @Override
    public List<CardOutput> flashcards(NoteContext n) {
        List<CardOutput> cards = new ArrayList<>();
        cards.add(new CardOutput("Summarise \"" + n.title() + "\" in one sentence.", strip(n.summary())));
        for (DefinitionOut d : n.definitions()) {
            cards.add(new CardOutput("What is " + d.term() + "?", d.def()));
        }
        for (SectionOut s : n.sections()) {
            cards.add(new CardOutput("Explain: " + s.title(), strip(s.body())));
        }
        for (int i = 0; i < n.takeaways().size(); i++) {
            cards.add(new CardOutput("Recall key point " + (i + 1) + " of \"" + cut(n.title(), 60) + "\"", n.takeaways().get(i)));
        }
        return cards.size() > 16 ? new ArrayList<>(cards.subList(0, 16)) : cards;
    }

    @Override
    public List<QuizQuestionOutput> quiz(NoteContext n) {
        List<String> pool = n.takeaways().isEmpty() ? List.of(cut(n.summary(), 120)) : n.takeaways();
        List<QuizQuestionOutput> out = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            String correct = cut(pool.get(i % pool.size()), 120);
            String topic = cut(n.sections().get(i % n.sections().size()).title(), 60);
            int answer = i % 3;
            List<String> options = new ArrayList<>(List.of(DISTRACTORS[0], DISTRACTORS[1]));
            options.add(answer, correct);
            out.add(new QuizQuestionOutput("Question " + (i + 1) + ": which statement matches the notes on \"" + topic + "\"?",
                    options, answer, "The notes state: " + correct, topic));
        }
        return out;
    }

    // ---- helpers ----
    private static List<String> sentences(String text) {
        List<String> out = new ArrayList<>();
        for (String s : text.replace('\n', ' ').split("(?<=[.!?])\\s+")) {
            if (s.trim().length() > 20) {
                out.add(s.trim());
            }
        }
        if (out.isEmpty()) {
            out.add(cut(text.trim(), 200));
        }
        return out;
    }

    private static List<DefinitionOut> definitions(List<String> sentences) {
        Set<String> seen = new LinkedHashSet<>();
        List<DefinitionOut> out = new ArrayList<>();
        Pattern word = Pattern.compile("[A-Za-z]{9,}");
        for (String s : sentences) {
            Matcher m = word.matcher(s);
            while (m.find() && out.size() < 3) {
                String w = m.group().toLowerCase(Locale.ROOT);
                if (seen.add(w)) {
                    out.add(new DefinitionOut(Character.toUpperCase(w.charAt(0)) + w.substring(1),
                            "Appears in the lecture: " + cut(s, 160)));
                }
            }
            if (out.size() >= 3) {
                break;
            }
        }
        return out;
    }

    private static String highlight(String text) {
        String best = "";
        for (String w : text.split("[^A-Za-z]+")) {
            if (w.length() > best.length()) {
                best = w;
            }
        }
        if (best.length() < 7) {
            return text;
        }
        return text.replaceFirst(Pattern.quote(best), Matcher.quoteReplacement("==" + best + "=="));
    }

    private static String strip(String s) {
        return s == null ? "" : s.replace("==", "");
    }

    private static String firstWords(String text, int n) {
        String[] w = text.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(n, w.length); i++) {
            sb.append(i == 0 ? "" : " ").append(w[i]);
        }
        return sb.toString().replaceAll("[^\\p{L}\\p{N} '-]", "").trim();
    }

    private static String cut(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1).trim() + "…";
    }
}
