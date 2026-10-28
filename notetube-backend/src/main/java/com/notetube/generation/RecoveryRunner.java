package com.notetube.generation;

import com.notetube.notes.NoteRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** After a restart, re-queues notes left queued/processing so nothing stays stuck forever. */
@Component
public class RecoveryRunner {

    private static final Logger log = LoggerFactory.getLogger(RecoveryRunner.class);

    private final NoteRepository notes;
    private final GenerationQueue queue;

    public RecoveryRunner(NoteRepository notes, GenerationQueue queue) {
        this.notes = notes;
        this.queue = queue;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void resumeInterruptedNotes() {
        List<String> ids = notes.idsToResume();
        if (!ids.isEmpty()) {
            log.info("Resuming {} interrupted note(s)", ids.size());
        }
        ids.forEach(queue::enqueue);
    }
}
