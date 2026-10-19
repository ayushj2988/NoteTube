import pino from "pino";

/** Never log passwords, cookies, ID tokens, transcripts or API keys: redact them defensively. */
export const createLogger = (level = "info") =>
  pino({
    level,
    redact: {
      paths: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.credential", "*.transcript_text",
        "*.transcript", "*.apiKey", "*.token"],
      censor: "[redacted]",
    },
  });
export type Logger = ReturnType<typeof createLogger>;
