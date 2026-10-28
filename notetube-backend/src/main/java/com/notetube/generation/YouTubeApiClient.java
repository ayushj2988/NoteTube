package com.notetube.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.notetube.common.ApiException;
import com.notetube.common.ErrorCode;
import com.notetube.config.AppProperties;
import com.notetube.config.HttpClients;
import java.time.Duration;
import java.time.format.DateTimeParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * YouTube Data API v3 videos.list (public metadata only). It does NOT download captions: the official
 * caption endpoints need OAuth and ownership, so transcripts come from pasted text or Gemini video input.
 * Without YOUTUBE_API_KEY, or if the API is unreachable or rejects the key, we skip the lookup.
 */
@Component
public class YouTubeApiClient implements VideoMetadataClient {

    private static final Logger log = LoggerFactory.getLogger(YouTubeApiClient.class);
    private static final String URL =
            "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id={id}&key={key}";

    private final AppProperties props;
    private final RestClient http = HttpClients.create(5_000, 10_000);

    public YouTubeApiClient(AppProperties props) {
        this.props = props;
    }

    @Override
    public VideoMetadata fetch(String videoId) {
        String key = props.youtubeApiKey();
        if (key == null || key.isBlank()) {
            return unknown();
        }
        JsonNode root;
        try {
            root = http.get().uri(URL, videoId, key).retrieve().body(JsonNode.class);
        } catch (RestClientResponseException e) {
            log.warn("YouTube API returned HTTP {}; skipping metadata", e.getStatusCode().value());
            return unknown();
        } catch (RestClientException e) {
            log.warn("YouTube API unreachable; skipping metadata");
            return unknown();
        }
        JsonNode items = root == null ? null : root.path("items");
        if (items == null || !items.isArray() || items.isEmpty()) {
            throw notFound();
        }
        JsonNode v = items.get(0);
        String privacy = v.path("status").path("privacyStatus").asText("public");
        String upload = v.path("status").path("uploadStatus").asText("processed");
        if ("private".equals(privacy) || "deleted".equals(upload) || "rejected".equals(upload) || "failed".equals(upload)) {
            throw notFound();
        }
        JsonNode snippet = v.path("snippet");
        JsonNode thumbs = snippet.path("thumbnails");
        String thumb = firstText(thumbs.path("high").path("url"), thumbs.path("medium").path("url"), thumbs.path("default").path("url"));
        return new VideoMetadata(blankToNull(snippet.path("title").asText(null)),
                blankToNull(snippet.path("channelTitle").asText(null)), thumb,
                parseDuration(v.path("contentDetails").path("duration").asText(null)));
    }

    static Integer parseDuration(String iso) {
        if (iso == null) {
            return null;
        }
        try {
            long s = Duration.parse(iso).getSeconds();
            return s > 0 && s < Integer.MAX_VALUE ? (int) s : null; // live streams report P0D
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static VideoMetadata unknown() {
        return new VideoMetadata(null, null, null, null);
    }

    private static ApiException notFound() {
        return new ApiException(ErrorCode.INVALID_URL, "We couldn't find that video. Check that it exists and is public.");
    }

    private static String firstText(JsonNode... nodes) {
        for (JsonNode n : nodes) {
            if (n != null && n.isTextual() && !n.asText().isBlank()) {
                return n.asText();
            }
        }
        return null;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
