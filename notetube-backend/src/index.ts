import { serve } from "@hono/node-server";
import { createApp, defaultLimiters } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/index.js";
import { createWorker } from "./jobs/worker.js";
import { createLogger } from "./lib/logger.js";
import { purgeExpiredSessions } from "./services/auth.js";
import { RealGeminiClient } from "./services/gemini.js";
import { RealGoogleVerifier } from "./services/google.js";
import { ChainProvider, YoutubeCaptionProvider } from "./services/transcript.js";
import { RealYouTubeClient } from "./services/videos.js";

const config = loadConfig(); // throws a readable list of missing variables
const logger = createLogger(config.LOG_LEVEL);
const { db, pool } = createDb(config.DATABASE_URL);

const deps = {
  youtube: new RealYouTubeClient(config.YOUTUBE_API_KEY),
  // add more providers here; the first one that returns captions wins
  transcripts: new ChainProvider([new YoutubeCaptionProvider()]),
  gemini: new RealGeminiClient(config.GEMINI_API_KEY, config.GEMINI_MODEL, config.GEMINI_MAX_RPM),
  google: new RealGoogleVerifier(config.GOOGLE_CLIENT_ID),
};

const worker = createWorker({ config, db, deps, logger });
const { app } = createApp({ config, db, deps, logger, limits: defaultLimiters(), notifyWorker: worker.notify });

await worker.start(); // also resumes notes a previous process left in "processing"
const purge = setInterval(() => purgeExpiredSessions(db).catch((e) => logger.warn({ err: e.message }, "session purge failed")), 24 * 3600_000);
void purgeExpiredSessions(db);

const server = serve({ fetch: app.fetch, port: config.PORT }, (i) => logger.info(`NoteTube API listening on :${i.port}`));

async function shutdown() {
  logger.info("shutting down");
  worker.stop(); clearInterval(purge);
  server.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
