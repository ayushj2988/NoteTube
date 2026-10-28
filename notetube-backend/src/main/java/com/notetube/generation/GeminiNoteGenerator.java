package com.notetube.generation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notetube.generation.GenerationModels.CardOutput;
import com.notetube.generation.GenerationModels.NoteContext;
import com.notetube.generation.GenerationModels.NotesOutput;
import com.notetube.generation.GenerationModels.QuizQuestionOutput;
import com.notetube.notes.Note;
import java.util.List;
import java.util.function.Function;
import java.util.function.IntConsumer;

/** Real generator: prompts + Gemini + strict validation (one retry if the answer is invalid). */
public class GeminiNoteGenerator implements NoteGenerator {

    private static final int CHUNK_THRESHOLD = 30_000;
    private static final int CHUNK_SIZE = 24_000;

    private static final String NOTES_SCHEMA = """
            {"type":"object","properties":{
              "title":{"type":"string"},"subject":{"type":"string"},"summary":{"type":"string"},
              "takeaways":{"type":"array","items":{"type":"string"}},
              "definitions":{"type":"array","items":{"type":"object","properties":{"term":{"type":"string"},"def":{"type":"string"}},"required":["term","def"]}},
              "sections":{"type":"array","items":{"type":"object","properties":{"ts":{"type":"integer"},"title":{"type":"string"},"body":{"type":"string"}},"required":["title","body"]}}
            },"required":["title","subject","summary","takeaways","definitions","sections"]}""";
    private static final String CARDS_SCHEMA = """
            {"type":"object","properties":{"cards":{"type":"array","items":{"type":"object","properties":{"front":{"type":"string"},"back":{"type":"string"}},"required":["front","back"]}}},"required":["cards"]}""";
    private static final String QUIZ_SCHEMA = """
            {"type":"object","properties":{"questions":{"type":"array","items":{"type":"object","properties":{"question":{"type":"string"},"options":{"type":"array","items":{"type":"string"}},"answerIndex":{"type":"integer"},"explanation":{"type":"string"},"topic":{"type":"string"}},"required":["question","options","answerIndex","explanation","topic"]}}},"required":["questions"]}""";
    private static final String CHUNK_SCHEMA = """
            {"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}""";

    private record CardsEnvelope(List<CardOutput> cards) {}

    private record QuizEnvelope(List<QuizQuestionOutput> questions) {}

    private record ChunkSummary(String summary) {}

    private final GeminiClient client;
    private final PromptLibrary prompts;
    private final ObjectMapper mapper;
    private final JsonNode notesSchema;
    private final JsonNode cardsSchema;
    private final JsonNode quizSchema;
    private final JsonNode chunkSchema;

    public GeminiNoteGenerator(GeminiClient client, PromptLibrary prompts, ObjectMapper mapper) {
        this.client = client;
        this.prompts = prompts;
        this.mapper = mapper;
        try {
            this.notesSchema = mapper.readTree(NOTES_SCHEMA);
            this.cardsSchema = mapper.readTree(CARDS_SCHEMA);
            this.quizSchema = mapper.readTree(QUIZ_SCHEMA);
            this.chunkSchema = mapper.readTree(CHUNK_SCHEMA);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Built-in schema is invalid", e);
        }
    }

    @Override
    public NotesOutput notesFromTranscript(String transcript, String titleHint, IntConsumer progress) {
        String material = transcript;
        if (transcript.length() > CHUNK_THRESHOLD) {
            List<String> chunks = TextChunker.split(transcript, CHUNK_SIZE);
            StringBuilder merged = new StringBuilder();
            for (int i = 0; i < chunks.size(); i++) {
                String summary = callAndParse(prompts.get("chunk.txt"), wrap("transcript", chunks.get(i)), null,
                        chunkSchema, t -> read(t, ChunkSummary.class).summary());
                merged.append("Part ").append(i + 1).append(":\n").append(summary).append("\n\n");
                progress.accept(10 + 60 * (i + 1) / chunks.size());
            }
            material = merged.toString();
        }
        progress.accept(75);
        String hint = Note.PLACEHOLDER_TITLES.contains(titleHint) ? "" : "Video title: " + titleHint + "\n";
        return callAndParse(prompts.get("notes.txt"), hint + wrap("transcript", material), null, notesSchema,
                t -> OutputValidator.cleanNotes(read(t, NotesOutput.class)));
    }

    @Override
    public NotesOutput notesFromVideo(String videoUrl, String titleHint) {
        String ask = "Create the study notes for the attached video. Give each section's start time in seconds (ts).";
        try {
            return callAndParse(prompts.get("notes.txt"), ask, videoUrl, notesSchema,
                    t -> OutputValidator.cleanNotes(read(t, NotesOutput.class)));
        } catch (GenerationException e) {
            // 400/403/404 from Gemini = it cannot open this video (private, no usable audio/captions, blocked...)
            if (e.httpStatus() == 400 || e.httpStatus() == 403 || e.httpStatus() == 404) {
                throw new GenerationException("NO_CAPTIONS",
                        "We couldn't read this video. Paste its transcript to continue.");
            }
            throw e;
        }
    }

    @Override
    public List<CardOutput> flashcards(NoteContext notes) {
        return callAndParse(prompts.get("flashcards.txt"), wrap("notes", notes.asText()), null, cardsSchema,
                t -> OutputValidator.cleanCards(read(t, CardsEnvelope.class).cards()));
    }

    @Override
    public List<QuizQuestionOutput> quiz(NoteContext notes) {
        return callAndParse(prompts.get("quiz.txt"), wrap("notes", notes.asText()), null, quizSchema,
                t -> OutputValidator.cleanQuiz(read(t, QuizEnvelope.class).questions()));
    }

    /** Calls Gemini; if the answer fails validation, asks once more telling the model what was wrong. */
    private <T> T callAndParse(String system, String userText, String videoUrl, JsonNode schema,
                               Function<String, T> parser) {
        String first = client.generate(system, userText, videoUrl, schema);
        try {
            return parser.apply(first);
        } catch (InvalidOutputException e) {
            String again = userText + "\n\nYour previous answer was rejected: " + e.getMessage()
                    + ".\nReturn corrected JSON only, following the schema exactly.";
            String second = client.generate(system, again, videoUrl, schema);
            try {
                return parser.apply(second);
            } catch (InvalidOutputException e2) {
                throw new GenerationException("AI_FAILED", "The AI returned an unusable answer. Please retry.");
            }
        }
    }

    private <T> T read(String text, Class<T> type) {
        try {
            return mapper.readValue(stripFences(text), type);
        } catch (JsonProcessingException e) {
            throw new InvalidOutputException("the answer was not valid JSON (" + e.getOriginalMessage() + ")");
        }
    }

    private static String stripFences(String s) {
        String t = s.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            t = nl < 0 ? "" : t.substring(nl + 1);
            if (t.endsWith("```")) {
                t = t.substring(0, t.length() - 3);
            }
        }
        return t.trim();
    }

    /** Delimits untrusted text. Any closing tag inside it is removed so it cannot break out. */
    private static String wrap(String tag, String text) {
        return "<" + tag + ">\n" + text.replace("</" + tag + ">", "") + "\n</" + tag + ">";
    }
}
