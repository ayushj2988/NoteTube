package com.notetube.generation;

import java.util.ArrayList;
import java.util.List;

/** Splits long transcripts into chunks of at most maxChars, preferring paragraph then sentence boundaries. */
public final class TextChunker {
    private TextChunker() {}

    public static List<String> split(String text, int maxChars) {
        List<String> out = new ArrayList<>();
        int n = text.length();
        int i = 0;
        while (i < n) {
            int end = Math.min(n, i + maxChars);
            if (end < n) {
                int cut = breakPoint(text, i, end);
                if (cut > i) {
                    end = cut;
                }
            }
            String part = text.substring(i, end).trim();
            if (!part.isEmpty()) {
                out.add(part);
            }
            i = end;
        }
        return out;
    }

    private static int breakPoint(String t, int start, int end) {
        int min = start + (end - start) / 2;
        for (int p = end; p > min; p--) {
            if (t.charAt(p - 1) == '\n') {
                return p;
            }
        }
        for (int p = end; p > min; p--) {
            char c = t.charAt(p - 1);
            if ((c == '.' || c == '!' || c == '?') && p < t.length() && Character.isWhitespace(t.charAt(p))) {
                return p;
            }
        }
        for (int p = end; p > min; p--) {
            if (t.charAt(p - 1) == ' ') {
                return p;
            }
        }
        return end;
    }
}
