package com.notetube.notes;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class YouTubeUrlsTest {

    private static final String ID = "dQw4w9WgXcQ";

    @Test
    void extractsIdFromAllSupportedShapes() {
        assertThat(YouTubeUrls.extractId("https://www.youtube.com/watch?v=" + ID + "&t=5", false)).contains(ID);
        assertThat(YouTubeUrls.extractId("https://youtu.be/" + ID + "?si=abc", false)).contains(ID);
        assertThat(YouTubeUrls.extractId("youtube.com/shorts/" + ID, false)).contains(ID);
        assertThat(YouTubeUrls.extractId("https://www.youtube.com/embed/" + ID, false)).contains(ID);
        assertThat(YouTubeUrls.extractId("https://m.youtube.com/watch?v=" + ID, false)).contains(ID);
    }

    @Test
    void rejectsOtherSitesAndBadIds() {
        assertThat(YouTubeUrls.extractId("https://vimeo.com/123456", false)).isEmpty();
        assertThat(YouTubeUrls.extractId("https://www.youtube.com/watch?v=short", false)).isEmpty();
        assertThat(YouTubeUrls.extractId("not a url at all", false)).isEmpty();
        assertThat(YouTubeUrls.extractId("", false)).isEmpty();
        assertThat(YouTubeUrls.extractId("https://evil.com/?u=youtube.com/watch?v=" + ID, false)).isEmpty();
    }

    @Test
    void lenientModeAcceptsShortDemoIds() {
        assertThat(YouTubeUrls.extractId("https://www.youtube.com/watch?v=nocaptions", true)).contains("nocaptions");
    }
}
