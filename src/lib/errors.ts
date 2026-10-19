import { ApiError } from '../api/client'
import type { ErrorCode } from '../api/types'

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  NETWORK: "Can't reach the server. Check your connection and try again.",
  UNAUTHENTICATED: 'Your session has ended. Please sign in again.',
  INVALID_CREDENTIALS: 'Wrong email or password.',
  EMAIL_TAKEN: 'An account with that email already exists. Try signing in instead.',
  INVALID_URL: "That doesn't look like a YouTube link. Try youtube.com/watch?v=… or youtu.be/…",
  VIDEO_NOT_FOUND: "We couldn't find that video. It may have been deleted, or the link is wrong.",
  VIDEO_PRIVATE: 'That video is private or restricted, so we cannot read it. Paste its transcript instead.',
  VIDEO_TOO_LONG: 'That video is longer than we can process in one go.',
  NO_CAPTIONS: 'This video has no captions we could read. Paste a transcript and try again.',
  TRANSCRIPT_TOO_SHORT: 'That transcript is too short to make notes from.',
  QUOTA_EXCEEDED: "You've used all of today's note generations.",
  RATE_LIMITED: "You're going a little fast. Wait a moment and try again.",
  AI_UNAVAILABLE: 'The AI service is busy right now. Try again in a minute.',
  AI_BAD_RESPONSE: 'The AI returned something we could not use. Trying again usually fixes it.',
  NOT_FOUND: "We couldn't find that. It may have been deleted.",
  FORBIDDEN: "You don't have access to that.",
  VALIDATION: 'Please check the highlighted fields.',
}

export function friendlyMessage(code: ErrorCode, serverMessage?: string): string {
  return MESSAGES[code] ?? serverMessage ?? 'Something went wrong. Please try again.'
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return friendlyMessage(e.code, e.message)
  return 'Something went wrong. Please try again.'
}

/** Per-field messages from a VALIDATION error. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiError && e.code === 'VALIDATION') {
    const f = (e.details as { fields?: Record<string, string> } | undefined)?.fields
    if (f) return f
  }
  return {}
}

/** Codes where pressing "Try again" with the same input can plausibly succeed. */
export function isRetryable(code: ErrorCode): boolean {
  return code === 'AI_UNAVAILABLE' || code === 'AI_BAD_RESPONSE' || code === 'RATE_LIMITED' || code === 'NETWORK' || code === 'UNKNOWN'
}
