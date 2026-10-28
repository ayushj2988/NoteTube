package com.notetube.generation;

/** The AI answered, but not in the shape we need. The message is sent back to the AI for one retry. */
public class InvalidOutputException extends RuntimeException {
    public InvalidOutputException(String message) {
        super(message);
    }
}
