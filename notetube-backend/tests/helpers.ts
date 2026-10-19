import { sql } from "drizzle-orm";
import { createApp, defaultLimiters, type LimitOverrides } from "../src/app.js";
import { loadConfig, type Config } from "../src/config.js";
import { createDb } from "../src/db/index.js";
import { createLogger } from "../src/lib/logger.js";
import { AppError } from "../src/lib/errors.js";
import { GeminiError, type GeminiClient, type GeminiRequest } from "../src/services/gemini.js";
import type { GoogleProfile, GoogleVerifier } from "../src/services/google.js";
import { NoCaptionsError, type FetchedTranscript, type TranscriptProvider } from "../src/services/transcript.js";
import type { RawVideo, YouTubeClient } from "../src/services/videos.js";
import { createWorker } from "../src/jobs/worker.js";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://notetube:notetube@localhost:5432/notetube_test";

export function testConfig(over: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test", DATABASE_URL: TEST_DB, FRONTEND_URL: "http://localhost:5173",
    SESSION_SECRET: "x".repeat(40), GOOGLE_CLIENT_ID: "test-client", GEMINI_API_KEY: "k", GEMINI_MODEL: "test-model",
    YOUTUBE_API_KEY: "k", DAILY_GENERATION_LIMIT: "5", MAX_VIDEO_MINUTES: "240", LOG_LEVEL: "silent", ...over,
  } as NodeJS.ProcessEnv);
}

// ---------- fakes ----------
export class FakeYouTube implements YouTubeClient {
  videos = new Map<string, RawVideo | AppError>();
  calls = 0;
  async getVideo(id: string) {
    this.calls++;
    const v = this.videos.get(id);
    if (!v) throw new AppError("VIDEO_NOT_FOUND", "We couldn't find that video.");
    if (v instanceof AppError) throw v;
    return v;
  }
}
export class FakeTranscripts implements TranscriptProvider {
  readonly name = "fake";
  items = new Map<string, FetchedTranscript | Error>();
  calls = 0;
  async fetch(id: string) {
    this.calls++;
    const t = this.items.get(id);
    if (!t) throw new NoCaptionsError("none");
    if (t instanceof Error) throw t;
    return t;
  }
}
export class FakeGoogle implements GoogleVerifier {
  profiles = new Map<string, GoogleProfile>();
  async verify(credential: string) {
    const p = this.profiles.get(credential);
    if (!p) throw new AppError("INVALID_CREDENTIALS", "Google sign-in could not be verified.");
    return p;
  }
}
export type GeminiHandler = (req: GeminiRequest, call: number) => string | Promise<string>;
export class FakeGemini implements GeminiClient {
  calls: GeminiRequest[] = [];
  handler: GeminiHandler = () => noteJson();
  async generate(req: GeminiRequest) { this.calls.push(req); return this.handler(req, this.calls.length); }
}
export const transient = () => new GeminiError("Provider error 429", 429, true);

export function noteJson(o: { flashcards?: number; quiz?: number; ts?: string; subject?: string } = {}) {
  const ts = o.ts ?? "00:05";
  return JSON.stringify({
    title: "Graph Traversal", subject: o.subject ?? "Algorithms",
    summary: "BFS and DFS explained.",
    key_concepts: ["BFS", "DFS", "queue", "stack", "visited set"],
    content_md: `## [${ts}] Intro\n- Graphs have nodes and edges.\n\n## [00:30] BFS\n- Uses a queue. <script>alert(1)</script>\n\n**Takeaway:** pick BFS for shortest paths. \`List<String>\``,
    skim: ["one", "two", "three", "four", "five"],
    flashcards: Array.from({ length: o.flashcards ?? 3 }, (_, i) => ({ front: `Question ${i + 1}?`, back: `Answer ${i + 1}.` })),
    quiz: Array.from({ length: o.quiz ?? 3 }, (_, i) => ({
      question: `Quiz question ${i + 1}?`, options: ["A", "B", "C", "D"], answer_index: i % 4, explanation: "Because.",
    })),
  });
}

export const LECTURE = Array.from({ length: 12 }, (_, i) => `[00:${String(i * 5).padStart(2, "0")}] This lecture explains graph traversal in some detail, covering nodes, edges and queues.`).join("\n");

// ---------- harness ----------
export async function makeHarness(opts: { limits?: LimitOverrides; config?: Record<string, string>; backoff?: number[] } = {}) {
  const config = testConfig(opts.config);
  const { db, pool } = createDb(TEST_DB);
  const deps = { youtube: new FakeYouTube(), transcripts: new FakeTranscripts(), gemini: new FakeGemini(), google: new FakeGoogle() };
  const logger = createLogger(process.env.TEST_LOG ?? "silent");
  const limits = defaultLimiters({ authMax: 1000, userMax: 100000, createMax: 1000, ...opts.limits });
  const worker = createWorker({ config, db, deps, logger, backoffMs: opts.backoff ?? [1, 1] });
  const { app } = createApp({ config, db, deps, logger, limits, notifyWorker: () => {} });
  await db.execute(sql`TRUNCATE users, videos, transcripts CASCADE`);
  return { app, db, pool, deps, config, worker, close: () => pool.end() };
}
export type Harness = Awaited<ReturnType<typeof makeHarness>>;

export class Client {
  cookie = "";
  constructor(private app: Harness["app"], private origin?: string) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { ...headers };
    if (body !== undefined) h["content-type"] = "application/json";
    if (this.cookie) h.cookie = this.cookie;
    if (this.origin) h.origin = this.origin;
    const res = await this.app.request(`/api${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = set.match(/nt_session=([^;]*)/);
      if (m) this.cookie = m[1] ? `nt_session=${m[1]}` : "";
    }
    const text = await res.text();
    let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: res.status, json, headers: res.headers, text };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b?: unknown) => this.req("POST", p, b);
  patch = (p: string, b?: unknown) => this.req("PATCH", p, b);
  del = (p: string) => this.req("DELETE", p);
}

let counter = 0;
export async function signedIn(h: Harness, name = "Ada") {
  const c = new Client(h.app, "http://localhost:5173");
  const r = await c.post("/auth/signup", { name, email: `user${++counter}-${Date.now()}@example.com`, password: "correct horse battery" });
  if (r.status !== 201) throw new Error(`signup failed: ${r.text}`);
  return { c, user: r.json.user as { id: string; email: string } };
}
