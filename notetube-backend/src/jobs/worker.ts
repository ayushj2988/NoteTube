import { eq, sql } from "drizzle-orm";
import type { Config } from "../config.js";
import type { Db } from "../db/index.js";
import { notes } from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";
import { failNote, processNote, type ClaimedNote, type PipelineCtx } from "../services/generation.js";
import type { Deps } from "../types.js";

const LEASE_SECONDS = 120;
const MAX_ATTEMPTS = 3;

export interface WorkerOptions { config: Config; db: Db; deps: Deps; logger: Logger; backoffMs?: number[] }

/**
 * Postgres-backed queue: notes are the jobs. A job is claimed with FOR UPDATE SKIP LOCKED and a lease.
 * A crashed worker's lease expires and the note is picked up again, so nothing stays stuck in "processing".
 */
export function createWorker(o: WorkerOptions) {
  const p: PipelineCtx = { config: o.config, db: o.db, deps: o.deps, logger: o.logger, backoffMs: o.backoffMs ?? [2000, 5000] };
  let timer: NodeJS.Timeout | undefined;
  let active = 0;
  let stopped = false;

  async function claim(): Promise<ClaimedNote | null> {
    const res = await o.db.execute(sql`
      UPDATE notes SET status = 'processing', progress_step = 1, attempts = attempts + 1,
             lease_until = now() + (${LEASE_SECONDS} * interval '1 second'), error_code = NULL, error_message = NULL, updated_at = now()
      WHERE id = (SELECT id FROM notes
                  WHERE status = 'queued' OR (status = 'processing' AND lease_until < now())
                  ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id, user_id, youtube_id, title, style, language, include, transcript_input, attempts`);
    return (res.rows[0] as unknown as ClaimedNote) ?? null;
  }

  async function runOne(): Promise<boolean> {
    const n = await claim();
    if (!n) return false;
    if (n.attempts > MAX_ATTEMPTS) { // crash-loop guard
      await failNote(p, n, new AppError("AI_UNAVAILABLE", "Generation kept failing. Please retry."));
      return true;
    }
    const beat = setInterval(() => {
      o.db.update(notes).set({ leaseUntil: sql`now() + (${LEASE_SECONDS} * interval '1 second')` }).where(eq(notes.id, n.id)).catch(() => {});
    }, 30_000);
    try { await processNote(p, n); } finally { clearInterval(beat); }
    return true;
  }

  async function runUntilIdle() { while (await runOne()) { /* keep going */ } }

  async function tick() {
    if (stopped) return;
    while (active < o.config.WORKER_CONCURRENCY) {
      let n: boolean;
      active++;
      try { n = await runOneDetached(); } catch (e) { active--; o.logger.error({ err: (e as Error).message }, "worker tick failed"); return; }
      if (!n) { active--; return; }
    }
  }
  // starts a job without awaiting its completion so several can run at once
  async function runOneDetached(): Promise<boolean> {
    const n = await claim();
    if (!n) return false;
    void (async () => {
      try {
        if (n.attempts > MAX_ATTEMPTS) await failNote(p, n, new AppError("AI_UNAVAILABLE", "Generation kept failing. Please retry."));
        else await processNote(p, n);
      } catch (e) { o.logger.error({ err: (e as Error).message }, "job crashed"); }
      finally { active--; void tick(); }
    })();
    return true;
  }

  return {
    runUntilIdle,
    notify: () => { void tick(); },
    /** On boot: anything left in "processing" belongs to a dead process, make it claimable straight away. */
    async start() {
      stopped = false;
      await o.db.execute(sql`UPDATE notes SET lease_until = now() WHERE status = 'processing'`);
      timer = setInterval(() => void tick(), 2000);
      void tick();
    },
    stop() { stopped = true; if (timer) clearInterval(timer); },
  };
}
export type Worker = ReturnType<typeof createWorker>;
