import type { Config } from "./config.js";
import type { Db } from "./db/index.js";
import type { Logger } from "./lib/logger.js";
import type { RateLimiter } from "./lib/ratelimit.js";
import type { YouTubeClient } from "./services/videos.js";
import type { TranscriptProvider } from "./services/transcript.js";
import type { GeminiClient } from "./services/gemini.js";
import type { GoogleVerifier } from "./services/google.js";

export interface AuthUser {
  id: string; name: string; email: string; avatarUrl: string | null; hasPassword: boolean; createdAt: Date;
}
export type Env = { Variables: { user: AuthUser; sessionHash: string } };

export interface Deps {
  youtube: YouTubeClient;
  transcripts: TranscriptProvider;
  gemini: GeminiClient;
  google: GoogleVerifier;
}
export interface Limiters {
  auth: RateLimiter;       // per IP and per email
  user: RateLimiter;       // all authenticated traffic
  create: RateLimiter;     // note creation
}
export interface Ctx {
  config: Config; db: Db; logger: Logger; deps: Deps; limits: Limiters;
  notifyWorker: () => void;
}
