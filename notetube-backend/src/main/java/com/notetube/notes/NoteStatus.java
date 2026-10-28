package com.notetube.notes;

/** String constants matching the status values in docs/API.md. */
public final class NoteStatus {
    public static final String QUEUED = "queued";
    public static final String PROCESSING = "processing";
    public static final String READY = "ready";
    public static final String FAILED = "failed";
    public static final String NONE = "none"; // extras only

    private NoteStatus() {}
}
