import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { AppError } from "./lib/errors.js";
import { clientIp } from "./lib/http.js";
import { COOKIE, userFromToken } from "./services/auth.js";
import type { Ctx, Env } from "./types.js";

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cache-Control", "no-store");
  c.header("X-Frame-Options", "DENY");
};

/** CSRF defence on top of SameSite: a state-changing request that carries an Origin must come from our frontend. */
export const originCheck = (frontendUrl: string): MiddlewareHandler => {
  const allowed = new URL(frontendUrl).origin;
  return async (c, next) => {
    const m = c.req.method;
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      const origin = c.req.header("origin");
      if (origin && origin !== allowed) throw new AppError("FORBIDDEN", "Request origin not allowed.");
    }
    await next();
  };
};

export const requireAuth = (ctx: Ctx): MiddlewareHandler<Env> => async (c, next) => {
  const token = getCookie(c, COOKIE);
  const found = token ? await userFromToken(ctx.db, token) : null;
  if (!found) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  ctx.limits.user.check(found.user.id); // 60 requests / minute / user
  c.set("user", found.user);
  c.set("sessionHash", found.hash);
  await next();
};

export const rateLimitHeader = (e: unknown): Record<string, string> => {
  if (e instanceof AppError && e.code === "RATE_LIMITED") return { "Retry-After": String(e.details?.retry_after ?? 60) };
  return {};
};

export { clientIp };
