import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { clientIp, parseBody } from "../lib/http.js";
import { requireAuth } from "../middleware.js";
import {
  checkLogin, clearSessionCookie, dropSession, signup, startSession, toAuthUser, upsertGoogleUser, userJson,
} from "../services/auth.js";
import type { Ctx, Env } from "../types.js";

const email = z.string().trim().toLowerCase().email("Enter a valid email.").max(254);
const SignupBody = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email,
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
});
const LoginBody = z.object({ email, password: z.string().min(1, "Enter your password.").max(128) });
const GoogleBody = z.object({ credential: z.string().min(10).max(8192) });

export function authRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  const limit = (c: Parameters<typeof clientIp>[0], mail?: string) => {
    ctx.limits.auth.check(`ip:${clientIp(c, ctx.config.TRUST_PROXY)}`);
    if (mail) ctx.limits.auth.check(`email:${mail}`);
  };

  r.post("/signup", async (c) => {
    const body = await parseBody(c, SignupBody);
    limit(c, body.email);
    const u = await signup(ctx.db, body.name, body.email, body.password);
    await startSession(c, ctx.db, ctx.config, u.id);
    return c.json({ user: userJson(toAuthUser(u)) }, 201);
  });

  r.post("/login", async (c) => {
    const body = await parseBody(c, LoginBody);
    limit(c, body.email);
    const u = await checkLogin(ctx.db, body.email, body.password);
    await startSession(c, ctx.db, ctx.config, u.id); // rotates the token
    return c.json({ user: userJson(toAuthUser(u)) });
  });

  r.post("/google", async (c) => {
    const body = await parseBody(c, GoogleBody);
    limit(c);
    const p = await ctx.deps.google.verify(body.credential);
    if (!p.emailVerified) throw new AppError("INVALID_CREDENTIALS", "Your Google email address isn't verified.");
    const u = await upsertGoogleUser(ctx.db, p);
    await startSession(c, ctx.db, ctx.config, u.id);
    return c.json({ user: userJson(toAuthUser(u)) });
  });

  r.post("/logout", requireAuth(ctx), async (c) => {
    await dropSession(ctx.db, c.get("sessionHash"));
    clearSessionCookie(c, ctx.config);
    return c.body(null, 204);
  });

  r.get("/me", requireAuth(ctx), (c) => c.json({ user: userJson(c.get("user")) }));
  return r;
}
