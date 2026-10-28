package com.notetube.generation;

/** Public details of a YouTube video. Any field may be null when unknown. */
public record VideoMetadata(String title, String channel, String thumbnailUrl, Integer durationSec) {}
