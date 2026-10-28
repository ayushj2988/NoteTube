package com.notetube.generation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Component;

/** Hands a note id to the worker pool. If the bounded queue is full, the note is failed cleanly. */
@Component
public class GenerationQueue {

    private static final Logger log = LoggerFactory.getLogger(GenerationQueue.class);

    private final GenerationWorker worker;
    private final NoteStateService state;

    public GenerationQueue(GenerationWorker worker, NoteStateService state) {
        this.worker = worker;
        this.state = state;
    }

    public void enqueue(String noteId) {
        try {
            worker.run(noteId);
        } catch (TaskRejectedException e) {
            log.warn("Generation queue is full; failing note {}", noteId);
            state.fail(noteId, "UNKNOWN", "The server is busy right now. Please retry in a minute.");
        }
    }
}
