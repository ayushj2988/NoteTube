import { z } from "zod";

const int = (def: number) => z.coerce.number().int().positive().default(def);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: int(8787),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_DAYS: int(30),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
  DAILY_GENERATION_LIMIT: int(5),
  MAX_VIDEO_MINUTES: int(240),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  WORKER_CONCURRENCY: int(2),
  GEMINI_MAX_RPM: int(10),
  LOG_LEVEL: z.string().default("info"),
});

export type Config = z.infer<typeof schema>;

/** Fails fast with a readable list of every missing/invalid variable. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${/undefined/.test(i.message) ? "missing (required)" : i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  return parsed.data;
}
