export type ErrorCode =
  | "UNAUTHENTICATED" | "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "VALIDATION" | "NOT_FOUND" | "FORBIDDEN"
  | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "INVALID_URL" | "VIDEO_NOT_FOUND" | "VIDEO_PRIVATE" | "VIDEO_TOO_LONG"
  | "NO_CAPTIONS" | "TRANSCRIPT_TOO_SHORT" | "AI_UNAVAILABLE" | "AI_BAD_RESPONSE" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401, INVALID_CREDENTIALS: 401, EMAIL_TAKEN: 409, VALIDATION: 422, NOT_FOUND: 404, FORBIDDEN: 403,
  RATE_LIMITED: 429, QUOTA_EXCEEDED: 429, INVALID_URL: 400, VIDEO_NOT_FOUND: 404, VIDEO_PRIVATE: 403,
  VIDEO_TOO_LONG: 422, NO_CAPTIONS: 422, TRANSCRIPT_TOO_SHORT: 422, AI_UNAVAILABLE: 503, AI_BAD_RESPONSE: 502, INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, message: string, readonly details?: Record<string, unknown>, status?: number) {
    super(message);
    this.status = status ?? STATUS[code];
  }
}

export const notFound = (what = "Not found") => new AppError("NOT_FOUND", what);
export const validation = (fields: Record<string, string>) =>
  new AppError("VALIDATION", "Some fields are invalid.", { fields });

/** Drizzle wraps driver errors (DrizzleQueryError), so the Postgres code lives on `.cause`. */
export function pgCode(e: unknown): string | undefined {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code ?? x?.cause?.code;
}
