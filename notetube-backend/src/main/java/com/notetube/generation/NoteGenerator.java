package com.notetube.generation;

import com.notetube.generation.GenerationModels.CardOutput;
import com.notetube.generation.GenerationModels.NoteContext;
import com.notetube.generation.GenerationModels.NotesOutput;
import com.notetube.generation.GenerationModels.QuizQuestionOutput;
import java.util.List;
import java.util.function.IntConsumer;

/** Everything the pipeline needs from an AI. Implemented by Gemini and by the offline demo generator. */
public interface NoteGenerator {

    NotesOutput notesFromTranscript(String transcript, String titleHint, IntConsumer progress);

    /** Uses the video itself (no transcript). Throws NO_CAPTIONS if the video cannot be used. */
    NotesOutput notesFromVideo(String videoUrl, String titleHint);

    List<CardOutput> flashcards(NoteContext notes);

    List<QuizQuestionOutput> quiz(NoteContext notes);
}
