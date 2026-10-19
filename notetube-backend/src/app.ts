import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import type { Db } from "./db/index.js";
import { AppError } from "./lib/errors.js";
import { zodToFields } from "./lib/http.js";
import type { Logger } from "./lib/logger.js";
import { RateLimiter } from "./lib/ratelimit.js";
import { originCheck, rateLimitHeader, securityHeaders } from "./middleware.js";
import { authRoutes } from "./routes/auth.js";
import { flashcardRoutes } from "./routes/flashcards.js";
import { folderRoutes } from "./routes/folders.js";
import { meRoutes } from "./routes/me.js";
import { noteRoutes } from "./routes/notes.js";
import { quizRoutes } from "./routes/quiz.js";
import { shareRoutes } from "./routes/share.js";
import { statsRoutes } from "./routes/stats.js";
import { tagRoutes } from "./routes/tags.js";
import { videoRoutes } from "./routes/videos.js";
import type { Ctx, Deps, Env, Limiters } from "./types.js";

export interface LimitOverrides { authMax?: number; userMax?: number; createMax?: number }

export function defaultLimiters(o: LimitOverrides = {}): Limiters {
  return {
    auth: new RateLimiter(o.authMax ?? 10, 15 * 60_000),   // 10 attempts / 15 min, per IP and per email
    user: new RateLimiter(o.userMax ?? 60, 60_000),        // 60 requests / min / user
    create: new RateLimiter(o.createMax ?? 3, 60_000),     // 3 note creations / min / user
  };
}

export interface AppOptions { config: Config; db: Db; deps: Deps; logger: Logger; limits?: Limiters; notifyWorker?: () => void }

export function createApp(opts: AppOptions) {
  const ctx: Ctx = {
    config: opts.config, db: opts.db, logger: opts.logger, deps: opts.deps,
    limits: opts.limits ?? defaultLimiters(), notifyWorker: opts.notifyWorker ?? (() => {}),
  };
  const app = new Hono();
  app.use("*", securityHeaders);
  app.use("/api/*", cors({ origin: new URL(opts.config.FRONTEND_URL).origin, credentials: true }));
  app.use("/api/*", originCheck(opts.config.FRONTEND_URL));
  app.use("/api/*", bodyLimit({
    maxSize: 1.5 * 1024 * 1024,
    onError: (c) => c.json({ error: { code: "VALIDATION", message: "Request body is too large.", details: { fields: { body: "Too large (max 1.5 MB)." } } } }, 413),
  }));

  const api = new Hono<Env>();
  api.route("/auth", authRoutes(ctx));
  api.route("/", meRoutes(ctx));
  api.route("/videos", videoRoutes(ctx));
  api.route("/notes", noteRoutes(ctx));
  api.route("/folders", folderRoutes(ctx));
  api.route("/tags", tagRoutes(ctx));
  api.route("/flashcards", flashcardRoutes(ctx));
  api.route("/quiz", quizRoutes(ctx));
  api.route("/", statsRoutes(ctx));
  api.route("/share", shareRoutes(ctx));
  app.route("/api", api);

  app.get("/healthz", (c) => c.json({ ok: true }));
  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found." } }, 404));
  app.onError((err, c) => {
    if (err instanceof AppError) {
      for (const [k, v] of Object.entries(rateLimitHeader(err))) c.header(k, v);
      const body: { code: string; message: string; details?: unknown } = { code: err.code, message: err.message };
      if (err.details && err.code !== "RATE_LIMITED") body.details = err.details;
      return c.json({ error: body }, err.status as 400);
    }
    if (err instanceof ZodError) {
      return c.json({ error: { code: "VALIDATION", message: "Some fields are invalid.", details: { fields: zodToFields(err) } } }, 422);
    }
    ctx.logger.error({ err: { name: err.name, message: err.message, stack: err.stack } }, "unhandled error");
    return c.json({ error: { code: "INTERNAL", message: "Something went wrong on our side." } }, 500);
  });
  return { app, ctx };
}
