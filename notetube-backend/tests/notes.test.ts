import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notes, transcripts, videos } from "../src/db/schema.js";
import { AppError } from "../src/lib/errors.js";
import { GeminiError } from "../src/services/gemini.js";
import { Client, LECTURE, makeHarness, noteJson, signedIn, transient, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(async () => { await h.close(); });

const ID = "aaaaaaaaaaa", URL = `https://youtu.be/${ID}`;
const video = (min = 20) => ({ title: "Graphs 101", channel: "CS Lab", durationSeconds: min * 60 });

beforeEach(async () => {
  await h.db.delete(transcripts); await h.db.delete(videos); // caches must not leak between tests
  h.deps.youtube.videos.clear(); h.deps.transcripts.items.clear(); h.deps.transcripts.calls = 0; h.deps.youtube.calls = 0;
  h.deps.gemini.calls = []; h.deps.gemini.handler = () => noteJson();
});

async function create(c: Client, body: Record<string, unknown>) { return c.post("/notes", body); }
async function pasted(c: Client, extra: Record<string, unknown> = {}) {
  return create(c, { title: "My lecture", transcript_text: LECTURE, ...extra });
}
async function insertNote(userId: string, o: Partial<typeof notes.$inferInsert> = {}) {
  const [n] = await h.db.insert(notes).values({ userId, title: "Seeded", status: "ready", contentMd: "body", ...o }).returning();
  return n!;
}

describe("videos/preview", () => {
  it("maps each failure to the right code and reports captions", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video());
    h.deps.youtube.videos.set("bbbbbbbbbbb", new AppError("VIDEO_PRIVATE", "private"));
    h.deps.youtube.videos.set("ccccccccccc", video(300));
    const code = async (url: string) => { const r = await c.post("/videos/preview", { url }); return [r.status, r.json?.error?.code] as const; };
    expect(await code("not a url")).toEqual([400, "INVALID_URL"]);
    expect(await code("https://evil.example/watch?v=aaaaaaaaaaa")).toEqual([400, "INVALID_URL"]);
    expect(await code("https://www.youtube.com/watch?v=short")).toEqual([400, "INVALID_URL"]);
    expect(await code("https://youtu.be/zzzzzzzzzzz")).toEqual([404, "VIDEO_NOT_FOUND"]);
    expect(await code("https://youtu.be/bbbbbbbbbbb")).toEqual([403, "VIDEO_PRIVATE"]);
    const long = await c.post("/videos/preview", { url: "https://youtu.be/ccccccccccc" });
    expect(long.status).toBe(422);
    expect(long.json.error).toMatchObject({ code: "VIDEO_TOO_LONG", details: { max_minutes: 240 } });

    h.deps.transcripts.items.set(ID, { language: "en", segments: [{ start: 0, text: "hello there" }] });
    const ok = await c.post("/videos/preview", { url: `https://www.youtube.com/watch?v=${ID}&t=5s` });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({
      video: { id: ID, title: "Graphs 101", channel: "CS Lab", duration_seconds: 1200, thumbnail_url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg` },
      captions: "available",
    });
    h.deps.transcripts.items.clear();
    await h.db.delete(transcripts); // forget the cached probe
    expect((await c.post("/videos/preview", { url: URL })).json.captions).toBe("unavailable");
    h.deps.transcripts.items.set(ID, new Error("rate limited"));
    expect((await c.post("/videos/preview", { url: URL })).json.captions).toBe("unknown");
    // metadata is cached for 24 h: the three calls above reused one YouTube lookup
    const before = h.deps.youtube.calls;
    await c.post("/videos/preview", { url: URL });
    expect(h.deps.youtube.calls).toBe(before);
  });
});

describe("creating notes", () => {
  it("validates input", async () => {
    const { c } = await signedIn(h);
    expect((await create(c, {})).json.error.details.fields.url).toBeTruthy();
    expect((await create(c, { transcript_text: LECTURE })).json.error.details.fields.title).toBeTruthy();
    expect((await create(c, { url: "https://example.com/x" })).json.error.code).toBe("INVALID_URL");
    const short = await create(c, { title: "t", transcript_text: "[00:01] too short" });
    expect(short.status).toBe(422);
    expect(short.json.error.code).toBe("TRANSCRIPT_TOO_SHORT");
    expect((await create(c, { title: "t", transcript_text: LECTURE, style: "poem" })).status).toBe(422);
  });

  it("queues, then the worker reaches ready; flashcards and questions exist only when requested", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video());
    h.deps.transcripts.items.set(ID, { language: "en", segments: Array.from({ length: 40 }, (_, i) => ({ start: i * 5, text: `Graph traversal sentence number ${i}.` })) });
    const seen: number[] = [];
    h.deps.gemini.handler = async () => {
      const [row] = await h.db.select({ s: notes.progressStep }).from(notes).where(sql`status = 'processing'`);
      seen.push(row!.s);
      return noteJson();
    };
    const r = await create(c, { url: URL, style: "concise", language: "hinglish", include: { flashcards: true, quiz: false, timestamps: true } });
    expect(r.status).toBe(202);
    expect(r.json).toMatchObject({ status: "queued", progress: { step: 1, total: 4, label: "Fetching transcript" }, error: null, shared: false, style: "concise", language: "hinglish" });

    await h.worker.runUntilIdle();
    expect(seen).toEqual([2]); // the model call starts in step 2 (step 3 is set while it runs)
    const n = (await c.get(`/notes/${r.json.id}`)).json;
    expect(n).toMatchObject({
      status: "ready", progress: null, title: "Graphs 101", subject: "Algorithms", flashcard_count: 3, question_count: 0,
      video: { id: ID, title: "Graphs 101", channel: "CS Lab", duration_seconds: 1200 },
    });
    expect(n.skim).toHaveLength(5);
    expect(n.content_md).toContain("## [00:05] Intro");
    expect(n.content_md).not.toContain("<script>"); // raw HTML stripped
    expect(n.content_md).toContain("`List<String>`"); // code left alone
    expect((await c.get(`/quiz/questions?note_id=${n.id}`)).json.items).toHaveLength(0);
    expect((await c.get(`/flashcards?note_id=${n.id}`)).json.total).toBe(3);

    // the model got the right instructions: header + untrusted-source wrapper, JSON schema, and the language
    const req = h.deps.gemini.calls[0]!;
    expect(req.system).toContain("Hinglish");
    expect(req.schema).toBeTruthy();
    expect(JSON.stringify(req.parts)).toContain("<source>");
  });

  it("caches provider captions but never user-pasted text", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video());
    h.deps.transcripts.items.set(ID, { language: "en", segments: [{ start: 0, text: "x ".repeat(150) }] });
    await create(c, { url: URL }); await h.worker.runUntilIdle();
    await create(c, { url: URL }); await h.worker.runUntilIdle();
    expect(h.deps.transcripts.calls).toBe(1); // second note reused the cache
    expect((await h.db.select().from(transcripts)).length).toBe(1);

    await h.db.delete(transcripts);
    const { c: c2 } = await signedIn(h);
    await create(c2, { url: URL, transcript_text: LECTURE }); await h.worker.runUntilIdle();
    expect((await h.db.select().from(transcripts)).length).toBe(0); // pasted text is not cached
  });

  it("resumes a note left in 'processing' by a crashed worker", async () => {
    const { c, user } = await signedIn(h);
    const n = await insertNote(user.id, { status: "processing", leaseUntil: new Date(Date.now() - 60_000), transcriptInput: LECTURE, title: "Resumed" });
    await h.worker.runUntilIdle();
    expect((await c.get(`/notes/${n.id}`)).json.status).toBe("ready");
  });

  it("rate limits note creation per user", async () => {
    const limited = await makeHarness({ limits: { createMax: 3 } });
    const { c } = await signedIn(limited);
    for (let i = 0; i < 3; i++) expect((await pasted(c)).status).toBe(202);
    const r = await pasted(c);
    expect(r.status).toBe(429);
    expect(r.json.error.code).toBe("RATE_LIMITED");
    await limited.close();
  });
});

describe("failure paths end failed with the right code and refund the quota", () => {
  const usage = async (c: Client) => (await c.get("/usage")).json.used as number;
  async function run(c: Client, body: Record<string, unknown>) {
    const r = await create(c, body);
    expect(r.status).toBe(202);
    expect(await usage(c)).toBe(1);
    await h.worker.runUntilIdle();
    return (await c.get(`/notes/${r.json.id}`)).json;
  }
  const expectFailed = async (c: Client, n: any, code: string) => {
    expect(n).toMatchObject({ status: "failed", progress: null, error: { code } });
    expect(n.error.message).toBeTruthy();
    expect(await usage(c)).toBe(0); // refunded
  };

  it("private video", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, new AppError("VIDEO_PRIVATE", "This video is private."));
    await expectFailed(c, await run(c, { url: URL }), "VIDEO_PRIVATE");
  });
  it("video too long", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video(241));
    await expectFailed(c, await run(c, { url: URL }), "VIDEO_TOO_LONG");
  });
  it("no captions anywhere (provider empty, Gemini cannot watch the video either)", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video());
    h.deps.gemini.handler = (req) => {
      if (req.parts.some((p) => p.kind === "video")) throw new GeminiError("cannot access video", 400, false);
      return noteJson();
    };
    await expectFailed(c, await run(c, { url: URL }), "NO_CAPTIONS");
  });
  it("falls back to Gemini watching the public video when no captions exist", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video());
    const r = await create(c, { url: URL });
    await h.worker.runUntilIdle();
    expect((await c.get(`/notes/${r.json.id}`)).json.status).toBe("ready");
    const req = h.deps.gemini.calls[0]!;
    expect(req.parts[0]).toEqual({ kind: "video", url: `https://www.youtube.com/watch?v=${ID}` }); // video part first, header text after
    expect(req.parts[1]!.kind).toBe("text");
    expect(await usage(c)).toBe(1); // a successful generation keeps its quota slot
  });
  it("bad model JSON: one repair attempt can succeed", async () => {
    const { c } = await signedIn(h);
    h.deps.gemini.handler = (_r, call) => (call === 1 ? "not json at all" : noteJson());
    const n = await run(c, { title: "t", transcript_text: LECTURE });
    expect(n.status).toBe("ready");
    expect(h.deps.gemini.calls).toHaveLength(2);
    expect(JSON.stringify(h.deps.gemini.calls[1]!.parts)).toContain("failed validation"); // the model is shown what was wrong
  });
  it("bad model JSON twice is AI_BAD_RESPONSE after exactly one repair", async () => {
    const { c } = await signedIn(h);
    h.deps.gemini.handler = () => "still not json";
    await expectFailed(c, await run(c, { title: "t", transcript_text: LECTURE }), "AI_BAD_RESPONSE");
    expect(h.deps.gemini.calls).toHaveLength(2);
  });
  it("provider 429s are retried twice, then AI_UNAVAILABLE", async () => {
    const { c } = await signedIn(h);
    h.deps.gemini.handler = () => { throw transient(); };
    await expectFailed(c, await run(c, { title: "t", transcript_text: LECTURE }), "AI_UNAVAILABLE");
    expect(h.deps.gemini.calls).toHaveLength(3);
  });
  it("a timestamp beyond the video length triggers the repair path", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video(10));
    h.deps.transcripts.items.set(ID, { language: "en", segments: [{ start: 0, text: "x ".repeat(150) }] });
    h.deps.gemini.handler = (_r, call) => (call === 1 ? noteJson({ ts: "59:00" }) : noteJson());
    const r = await create(c, { url: URL });
    await h.worker.runUntilIdle();
    expect((await c.get(`/notes/${r.json.id}`)).json.status).toBe("ready");
    expect(h.deps.gemini.calls).toHaveLength(2);
  });
  it("retry re-queues a failed note, with a pasted transcript, and counts toward quota again", async () => {
    const { c } = await signedIn(h);
    h.deps.youtube.videos.set(ID, video());
    h.deps.gemini.handler = (req) => {
      if (req.parts.some((p) => p.kind === "video")) throw new GeminiError("nope", 400, false);
      return noteJson();
    };
    const r = await create(c, { url: URL }); await h.worker.runUntilIdle();
    expect((await c.get(`/notes/${r.json.id}`)).json.error.code).toBe("NO_CAPTIONS");
    expect((await c.post(`/notes/${r.json.id}/retry`, { transcript_text: "tiny" })).json.error.code).toBe("TRANSCRIPT_TOO_SHORT");
    const retry = await c.post(`/notes/${r.json.id}/retry`, { transcript_text: LECTURE });
    expect(retry.status).toBe(202);
    expect(retry.json.status).toBe("queued");
    expect(await usage(c)).toBe(1);
    await h.worker.runUntilIdle();
    expect((await c.get(`/notes/${r.json.id}`)).json.status).toBe("ready");
    expect((await c.post(`/notes/${r.json.id}/retry`)).status).toBe(422); // only failed notes
  });
});

describe("daily quota", () => {
  it("the 6th creation is QUOTA_EXCEEDED, and a failed note frees one slot", async () => {
    const { c } = await signedIn(h);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await pasted(c, { title: `n${i}` })).json.id);
    const blocked = await pasted(c);
    expect(blocked.status).toBe(429);
    expect(blocked.json.error.code).toBe("QUOTA_EXCEEDED");
    expect(blocked.json.error.details).toMatchObject({ limit: 5, used: 5 });
    expect(new Date(blocked.json.error.details.resets_at).getTime()).toBeGreaterThan(Date.now());
    expect((await c.get("/usage")).json).toMatchObject({ used: 5, limit: 5 });

    let calls = 0;
    h.deps.gemini.handler = () => { if (++calls <= 3) throw transient(); return noteJson(); }; // first note burns 3 calls and fails
    await h.worker.runUntilIdle();
    expect((await c.get("/usage")).json.used).toBe(4);
    expect((await pasted(c)).status).toBe(202);
    // deleting a note never refunds
    await c.del(`/notes/${ids[1]}`);
    expect((await c.get("/usage")).json.used).toBe(5);
  });
});

describe("listing, search, filters", () => {
  it("finds words that only exist in content_md, filters, sorts and paginates", async () => {
    const { c, user } = await signedIn(h);
    const f = (await c.post("/folders", { name: "Exams" })).json;
    for (let i = 0; i < 5; i++) await insertNote(user.id, { title: `Note ${String.fromCharCode(69 - i)}`, tags: i % 2 ? ["math"] : ["cs", "graphs"], folderId: i === 0 ? f.id : null, createdAt: new Date(Date.now() - i * 1000) });
    const target = await insertNote(user.id, { title: "Plain title", contentMd: "Today we discuss the xylophone in depth." });
    await h.db.insert((await import("../src/db/schema.js")).flashcards).values({ userId: user.id, noteId: target.id, front: "f", back: "b" });

    expect((await c.get("/notes?q=xylophone")).json.items.map((n: any) => n.id)).toEqual([target.id]);
    expect((await c.get("/notes?q=xylo")).json.total).toBe(1); // prefix match while typing
    expect((await c.get("/notes?q=zzzzzz")).json.total).toBe(0);
    expect((await c.get("/notes?tag=math")).json.total).toBe(2);
    expect((await c.get(`/notes?folder_id=${f.id}`)).json.total).toBe(1);
    expect((await c.get("/notes?folder_id=none")).json.total).toBe(5);
    expect((await c.get("/notes?has_cards=1")).json.items.map((n: any) => n.id)).toEqual([target.id]);
    expect((await c.get("/notes?has_quiz=1")).json.total).toBe(0);
    expect((await c.get("/notes?status=failed")).json.total).toBe(0);
    expect((await c.get("/notes?sort=title&limit=2")).json.items.map((n: any) => n.title)).toEqual(["Note A", "Note B"]);

    const p1 = (await c.get("/notes?sort=oldest&limit=4&offset=0")).json, p2 = (await c.get("/notes?sort=oldest&limit=4&offset=4")).json;
    expect(p1.total).toBe(6); expect(p2.total).toBe(6);
    expect(p1.items).toHaveLength(4); expect(p2.items).toHaveLength(2);
    expect(new Set([...p1.items, ...p2.items].map((n: any) => n.id)).size).toBe(6);
    expect((await c.get("/notes?limit=1000")).status).toBe(422);

    const tags = (await c.get("/tags")).json.items;
    expect(tags[0]).toMatchObject({ tag: expect.any(String), count: expect.any(Number) });
    expect(tags.find((t: any) => t.tag === "math").count).toBe(2);
  });

  it("patch: title, tags (lower-cased, max 12), folder, content stays searchable", async () => {
    const { c, user } = await signedIn(h);
    const n = await insertNote(user.id);
    const f = (await c.post("/folders", { name: "Work" })).json;
    const r = await c.patch(`/notes/${n.id}`, { title: "New title", tags: ["Graphs", "BFS", "graphs"], folder_id: f.id, subject: "CS", content_md: "## Heading\nflamingo <b>bold</b>" });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ title: "New title", tags: ["graphs", "bfs"], folder_id: f.id, subject: "CS", content_md: "## Heading\nflamingo bold" });
    expect((await c.get("/notes?q=flamingo")).json.total).toBe(1);
    expect((await c.patch(`/notes/${n.id}`, { tags: Array.from({ length: 13 }, (_, i) => `t${i}`) })).status).toBe(422);
    expect((await c.patch(`/notes/${n.id}`, { folder_id: "00000000-0000-4000-8000-000000000000" })).status).toBe(422);
    expect((await c.patch(`/notes/${n.id}`, { bogus: 1 })).status).toBe(422);
    expect((await c.del(`/folders/${f.id}`)).status).toBe(204);
    expect((await c.get(`/notes/${n.id}`)).json.folder_id).toBeNull(); // unfiled, not deleted
  });
});

describe("sharing", () => {
  it("create, public fetch without a cookie, idempotent, revoke -> 404", async () => {
    const { c, user } = await signedIn(h, "Sharer");
    const n = await insertNote(user.id, { title: "Shared note", summary: "sum", contentMd: "## [00:01] a", keyConcepts: ["k"], skim: ["s"] });
    const a = await c.post(`/notes/${n.id}/share`), b = await c.post(`/notes/${n.id}/share`);
    expect(a.status).toBe(200);
    expect(a.json.token).toBe(b.json.token);
    expect(a.json.token).toMatch(/^[A-Za-z0-9_-]{22}$/); // 128 bits, URL safe
    expect((await c.get(`/notes/${n.id}`)).json).toMatchObject({ shared: true, share_token: a.json.token });

    const anon = new Client(h.app);
    const pub = await anon.get(`/share/${a.json.token}`);
    expect(pub.status).toBe(200);
    expect(Object.keys(pub.json).sort()).toEqual(["author_name", "content_md", "created_at", "key_concepts", "skim", "summary", "title", "video"]);
    expect(pub.json).toMatchObject({ title: "Shared note", author_name: "Sharer", video: null });
    expect(pub.headers.get("cache-control")).toBe("no-store");
    expect(pub.headers.get("x-robots-tag")).toBe("noindex");

    expect((await c.del(`/notes/${n.id}/share`)).status).toBe(204);
    const gone = await anon.get(`/share/${a.json.token}`);
    expect(gone.status).toBe(404);
    expect(gone.json.error.code).toBe("NOT_FOUND");
    expect((await anon.get("/share/not-a-token")).status).toBe(404);
  });
});

describe("deleting data", () => {
  it("DELETE /me/data keeps the account and quota history; DELETE /me removes the user and invalidates the session", async () => {
    const { c, user } = await signedIn(h);
    await pasted(c); await h.worker.runUntilIdle();
    await c.post("/folders", { name: "F" });
    const list = (await c.get("/notes")).json;
    expect(list.total).toBe(1);
    await c.post("/sessions", { kind: "reading", seconds: 60 });

    expect((await c.del("/me/data")).status).toBe(204);
    expect((await c.get("/notes")).json.total).toBe(0);
    expect((await c.get("/flashcards")).json.total).toBe(0);
    expect((await c.get("/folders")).json.items).toHaveLength(0);
    expect((await c.get("/stats/summary")).json.minutes_total).toBe(0);
    expect((await c.get("/auth/me")).status).toBe(200);
    expect((await c.get("/usage")).json.used).toBe(1); // deleting data must not reset the quota

    const cookie = c.cookie;
    expect((await c.del("/me")).status).toBe(204);
    c.cookie = cookie;
    expect((await c.get("/auth/me")).status).toBe(401);
    const left = await h.db.execute(sql`SELECT (SELECT count(*) FROM users WHERE id = ${user.id})::int AS u, (SELECT count(*) FROM notes WHERE user_id = ${user.id})::int AS n,
      (SELECT count(*) FROM sessions WHERE user_id = ${user.id})::int AS s, (SELECT count(*) FROM generation_log WHERE user_id = ${user.id})::int AS g`);
    expect(left.rows[0]).toEqual({ u: 0, n: 0, s: 0, g: 0 });
  });
});
