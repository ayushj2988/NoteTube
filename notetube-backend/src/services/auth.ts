import { hash, verify } from "@node-rs/argon2";
import { and, eq, lt } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Config } from "../config.js";
import type { Db } from "../db/index.js";
import { sessions, settings, users } from "../db/schema.js";
import { newSessionToken, sha256 } from "../lib/crypto.js";
import { AppError, pgCode } from "../lib/errors.js";
import type { AuthUser } from "../types.js";

export const COOKIE = "nt_session";

type UserRow = typeof users.$inferSelect;
export const toAuthUser = (u: UserRow): AuthUser => ({
  id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, hasPassword: !!u.passwordHash, createdAt: u.createdAt,
});
export const userJson = (u: AuthUser) => ({
  id: u.id, name: u.name, email: u.email, avatar_url: u.avatarUrl, has_password: u.hasPassword, created_at: u.createdAt.toISOString(),
});

let dummyHash: Promise<string> | undefined;
/** Verified when the email is unknown so unknown-email and wrong-password take the same time. */
export function burnPasswordCheck(password: string) {
  dummyHash ??= hash("not-a-real-password");
  return dummyHash.then((h) => verify(h, password).catch(() => false));
}

export async function createSession(db: Db, config: Config, userId: string, userAgent: string | undefined) {
  const token = newSessionToken();
  await db.insert(sessions).values({
    tokenHash: sha256(token), userId, userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + config.SESSION_DAYS * 86_400_000),
  });
  return token;
}

export function setSessionCookie(c: Context, config: Config, token: string) {
  setCookie(c, COOKIE, token, {
    httpOnly: true, sameSite: "Lax", path: "/", secure: config.NODE_ENV === "production",
    maxAge: config.SESSION_DAYS * 86_400,
  });
}
export const clearSessionCookie = (c: Context, config: Config) =>
  deleteCookie(c, COOKIE, { path: "/", secure: config.NODE_ENV === "production" });

/** Rotates the session: drops whichever session the browser presented and issues a fresh one. */
export async function startSession(c: Context, db: Db, config: Config, userId: string) {
  const old = getCookie(c, COOKIE);
  if (old) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(old)));
  const token = await createSession(db, config, userId, c.req.header("user-agent"));
  setSessionCookie(c, config, token);
}

export async function userFromToken(db: Db, token: string): Promise<{ user: AuthUser; hash: string } | null> {
  const h = sha256(token);
  const rows = await db.select({ u: users, exp: sessions.expiresAt }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.tokenHash, h)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.exp.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, h));
    return null;
  }
  return { user: toAuthUser(row.u), hash: h };
}

export const purgeExpiredSessions = (db: Db) => db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

export async function signup(db: Db, name: string, email: string, password: string) {
  const passwordHash = await hash(password);
  try {
    const [u] = await db.insert(users).values({ name, email, passwordHash }).returning();
    await db.insert(settings).values({ userId: u!.id }).onConflictDoNothing();
    return u!;
  } catch (e: unknown) {
    if (pgCode(e) === "23505") throw new AppError("EMAIL_TAKEN", "An account with this email already exists.");
    throw e;
  }
}

export async function checkLogin(db: Db, email: string, password: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u || !u.passwordHash) {
    await burnPasswordCheck(password);
    throw new AppError("INVALID_CREDENTIALS", "Wrong email or password.");
  }
  const ok = await verify(u.passwordHash, password).catch(() => false);
  if (!ok) throw new AppError("INVALID_CREDENTIALS", "Wrong email or password.");
  return u;
}

export async function upsertGoogleUser(db: Db, p: { sub: string; email: string; name: string; picture: string | null }) {
  const [bySub] = await db.select().from(users).where(eq(users.googleSub, p.sub)).limit(1);
  if (bySub) return bySub;
  const [byEmail] = await db.select().from(users).where(eq(users.email, p.email)).limit(1);
  if (byEmail) {
    const [u] = await db.update(users).set({ googleSub: p.sub, avatarUrl: byEmail.avatarUrl ?? p.picture })
      .where(eq(users.id, byEmail.id)).returning();
    return u!;
  }
  const [u] = await db.insert(users).values({ name: p.name, email: p.email, googleSub: p.sub, avatarUrl: p.picture }).returning();
  await db.insert(settings).values({ userId: u!.id }).onConflictDoNothing();
  return u!;
}

export async function dropSession(db: Db, tokenHash: string) {
  await db.delete(sessions).where(and(eq(sessions.tokenHash, tokenHash)));
}
