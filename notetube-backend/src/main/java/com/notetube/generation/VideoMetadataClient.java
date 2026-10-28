package com.notetube.generation;

public interface VideoMetadataClient {
    /** Throws ApiException(INVALID_URL) if the video does not exist or is not public. */
    VideoMetadata fetch(String videoId);
}
