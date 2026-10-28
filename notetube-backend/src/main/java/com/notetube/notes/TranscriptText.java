package com.notetube.notes;

/** Cleans pasted transcripts. */
public final class TranscriptText {
    public static final int MAX_CHARS = 1_500_000;

    private TranscriptText() {}

    public static String normalize(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replace("\r\n", "\n").replace('\r', '\n');
        t = t.replaceAll("[\\p{Cntrl}&&[^\\n\\t]]", "");
        t = t.replaceAll("[ \\t]+", " ");
        t = t.replaceAll(" ?\n ?", "\n");
        t = t.replaceAll("\n{3,}", "\n\n");
        return t.trim();
    }

    public static int wordCount(String s) {
        if (s == null || s.isBlank()) {
            return 0;
        }
        return s.trim().split("\\s+").length;
    }
}
