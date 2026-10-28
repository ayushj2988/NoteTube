package com.notetube.generation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class TextChunkerTest {

    @Test
    void chunksNeverExceedTheLimitAndKeepAllText() {
        String text = "word ".repeat(20000).trim();
        List<String> parts = TextChunker.split(text, 24000);
        assertThat(parts).hasSizeGreaterThanOrEqualTo(4);
        assertThat(parts).allSatisfy(p -> assertThat(p.length()).isLessThanOrEqualTo(24000));
        assertThat(String.join(" ", parts).replaceAll("\\s+", " ")).hasSize(text.length());
    }

    @Test
    void shortTextIsOneChunk() {
        assertThat(TextChunker.split("hello world", 100)).containsExactly("hello world");
    }
}
