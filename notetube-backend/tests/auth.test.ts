import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(async () => { await h.close(); });
const fresh = () => new Client(h.app, "http://localhost:5173");

describe("auth", () => {
  it("signup, me, logout, then me is 401", async () => {
    const c = fresh();
    const s = await c.post("/auth/signup", { name: "Ada", email: "Ada@Example.com", password: "correct horse battery" });
    expect(s.status).toBe(201);
    expect(s.json.user).toMatchObject({ name: "Ada", email: "ada@example.com", has_password: true, avatar_url: null });
    expect(s.headers.get("set-cookie")).toMatch(/nt_session=.*HttpOnly.*SameSite=Lax/i);

    const me = await c.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.json.user.email).toBe("ada@example.com");

    const out = await c.post("/auth/logout");
    expect(out.status).toBe(204);
    c.cookie = s.headers.get("set-cookie")!.match(/nt_session=[^;]+/)![0]; // replay the old cookie
    expect((await c.get("/auth/me")).status).toBe(401); // the session row is really gone
  });

  it("login works and rotates the session token", async () => {
    const c = fresh();
    await c.post("/auth/signup", { name: "Bo", email: "bo@example.com", password: "password123" });
    const first = c.cookie;
    const l = await c.post("/auth/login", { email: "BO@example.com", password: "password123" });
    expect(l.status).toBe(200);
    expect(c.cookie).not.toBe(first);
    expect((await c.get("/auth/me")).status).toBe(200);
    const old = fresh(); old.cookie = first;
    expect((await old.get("/auth/me")).status).toBe(401);
  });

  it("wrong password and unknown email give identical responses", async () => {
    await fresh().post("/auth/signup", { name: "Cy", email: "cy@example.com", password: "password123" });
    const a = await fresh().post("/auth/login", { email: "cy@example.com", password: "wrong-password" });
    const b = await fresh().post("/auth/login", { email: "nobody@example.com", password: "wrong-password" });
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.json).toEqual(b.json);
    expect(a.json.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("duplicate email is EMAIL_TAKEN (case-insensitive)", async () => {
    await fresh().post("/auth/signup", { name: "Di", email: "di@example.com", password: "password123" });
    const r = await fresh().post("/auth/signup", { name: "Di2", email: "DI@example.com", password: "password123" });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("EMAIL_TAKEN");
  });

  it("validation errors carry details.fields", async () => {
    const r = await fresh().post("/auth/signup", { name: "", email: "nope", password: "short" });
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe("VALIDATION");
    expect(Object.keys(r.json.error.details.fields)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("missing cookie is UNAUTHENTICATED", async () => {
    for (const p of ["/auth/me", "/notes", "/settings", "/usage", "/flashcards", "/stats/summary"]) {
      const r = await fresh().get(p);
      expect(r.status, p).toBe(401);
      expect(r.json.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("google sign-in creates a user, then links by email, and requires a verified email", async () => {
    const g = h.deps.google;
    g.profiles.set("tok-new", { sub: "sub-1", email: "gina@example.com", emailVerified: true, name: "Gina", picture: "https://x/p.png" });
    const c1 = fresh();
    const r1 = await c1.post("/auth/google", { credential: "tok-new-0000" + "x" });
    expect(r1.status).toBe(401); // unknown credential

    g.profiles.set("tok-new-0000x", g.profiles.get("tok-new")!);
    const ok = await fresh().post("/auth/google", { credential: "tok-new-0000x" });
    expect(ok.status).toBe(200);
    expect(ok.json.user).toMatchObject({ email: "gina@example.com", has_password: false, avatar_url: "https://x/p.png" });

    // existing password account gets linked, not duplicated
    await fresh().post("/auth/signup", { name: "Hal", email: "hal@example.com", password: "password123" });
    g.profiles.set("tok-hal-0000x", { sub: "sub-2", email: "hal@example.com", emailVerified: true, name: "Hal G", picture: null });
    const linked = await fresh().post("/auth/google", { credential: "tok-hal-0000x" });
    expect(linked.json.user).toMatchObject({ email: "hal@example.com", name: "Hal", has_password: true });

    g.profiles.set("tok-unv-0000x", { sub: "sub-3", email: "ivy@example.com", emailVerified: false, name: "Ivy", picture: null });
    expect((await fresh().post("/auth/google", { credential: "tok-unv-0000x" })).status).toBe(401);
  });

  it("rejects cross-origin state-changing requests", async () => {
    const evil = new Client(h.app, "https://evil.example");
    const r = await evil.post("/auth/signup", { name: "E", email: "e@example.com", password: "password123" });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("FORBIDDEN");
  });

  it("rate limits auth attempts with Retry-After", async () => {
    const limited = await makeHarness({ limits: { authMax: 3 } });
    const c = new Client(limited.app, "http://localhost:5173");
    for (let i = 0; i < 3; i++) await c.post("/auth/login", { email: "x@example.com", password: "whatever1" });
    const r = await c.post("/auth/login", { email: "x@example.com", password: "whatever1" });
    expect(r.status).toBe(429);
    expect(r.json.error.code).toBe("RATE_LIMITED");
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    await limited.close();
  });

  it("account: patch name, settings defaults + patch, export, delete data, delete account", async () => {
    const c = fresh();
    await c.post("/auth/signup", { name: "Jo", email: "jo@example.com", password: "password123" });
    expect((await c.patch("/me", { name: "Joanna" })).json.user.name).toBe("Joanna");
    expect((await c.get("/settings")).json).toEqual({ daily_reminder: true, auto_flashcards: true, reduce_motion: false, default_style: "detailed", default_language: "en" });
    const p = await c.patch("/settings", { reduce_motion: true, default_language: "hinglish" });
    expect(p.json).toMatchObject({ reduce_motion: true, default_language: "hinglish", daily_reminder: true });
    expect((await c.patch("/settings", { default_style: "novel" })).status).toBe(422);
    expect((await c.get("/usage")).json).toMatchObject({ used: 0, limit: 5 });
    const ex = await c.get("/me/export");
    expect(ex.status).toBe(200);
    expect(ex.headers.get("content-disposition")).toMatch(/attachment/);
    expect(ex.json.user.email).toBe("jo@example.com");
    expect(JSON.stringify(ex.json)).not.toMatch(/password_hash|argon2/);
    expect((await c.del("/me/data")).status).toBe(204);
    expect((await c.get("/auth/me")).status).toBe(200); // account survives
    const cookie = c.cookie;
    expect((await c.del("/me")).status).toBe(204);
    c.cookie = cookie;
    expect((await c.get("/auth/me")).status).toBe(401); // user and sessions gone
  });
});
