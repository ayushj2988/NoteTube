package com.notetube.notes;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/** Extracts the video id from watch?v=, youtu.be/, /shorts/, /embed/, /live/ and /v/ links. */
public final class YouTubeUrls {
    private static final Pattern STRICT_ID = Pattern.compile("[A-Za-z0-9_-]{11}");
    private static final Pattern LOOSE_ID = Pattern.compile("[A-Za-z0-9_-]{1,20}");
    private static final String[] PATH_PREFIXES = {"/shorts/", "/embed/", "/live/", "/v/"};

    private YouTubeUrls() {}

    /** lenient=true accepts ids that are not 11 characters (only used by the demo "nocaptions" test links). */
    public static Optional<String> extractId(String raw, boolean lenient) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String s = raw.trim();
        if (!s.regionMatches(true, 0, "http://", 0, 7) && !s.regionMatches(true, 0, "https://", 0, 8)) {
            s = "https://" + s;
        }
        URI uri;
        try {
            uri = new URI(s);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
        String host = uri.getHost();
        if (host == null) {
            return Optional.empty();
        }
        host = host.toLowerCase(Locale.ROOT);
        if (host.startsWith("www.")) {
            host = host.substring(4);
        } else if (host.startsWith("m.")) {
            host = host.substring(2);
        }
        String path = uri.getPath() == null ? "" : uri.getPath();

        String candidate = null;
        if (host.equals("youtu.be")) {
            candidate = firstSegment(path);
        } else if (host.equals("youtube.com") || host.equals("music.youtube.com") || host.equals("youtube-nocookie.com")) {
            if (path.equals("/watch")) {
                candidate = queryParam(uri.getRawQuery(), "v");
            } else {
                for (String prefix : PATH_PREFIXES) {
                    if (path.startsWith(prefix)) {
                        candidate = firstSegment(path.substring(prefix.length()));
                        break;
                    }
                }
            }
        }
        if (candidate == null) {
            return Optional.empty();
        }
        Pattern p = lenient ? LOOSE_ID : STRICT_ID;
        return p.matcher(candidate).matches() ? Optional.of(candidate) : Optional.empty();
    }

    private static String firstSegment(String path) {
        String p = path;
        while (p.startsWith("/")) {
            p = p.substring(1);
        }
        int slash = p.indexOf('/');
        return slash < 0 ? p : p.substring(0, slash);
    }

    private static String queryParam(String rawQuery, String name) {
        if (rawQuery == null) {
            return null;
        }
        for (String pair : rawQuery.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(name)) {
                return pair.substring(eq + 1);
            }
        }
        return null;
    }
}
