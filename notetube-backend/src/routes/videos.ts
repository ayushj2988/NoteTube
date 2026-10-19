import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { transcripts } from "../db/schema.js";
import { parseBody } from "../lib/http.js";
import { parseYoutubeUrl } from "../lib/youtube.js";
import { requireAuth } from "../middleware.js";
import { NoCaptionsError, segmentsToText } from "../services/transcript.js";
import { assertNotTooLong, getVideoMeta } from "../services/videos.js";
import type { Ctx, Env } from "../types.js";

export function videoRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  r.use("*", requireAuth(ctx));

  r.post("/preview", async (c) => {
    const { url } = await parseBody(c, z.object({ url: z.string().trim().min(1, "Paste a YouTube link.").max(2048) }));
    const id = parseYoutubeUrl(url);
    const video = await getVideoMeta(ctx.db, ctx.deps.youtube, id); // cached 24 h
    assertNotTooLong(video, ctx.config.MAX_VIDEO_MINUTES);
    return c.json({ video, captions: await probeCaptions(id, video.duration_seconds) });
  });

  /** Best-effort: never an error. Successful probes are cached (provider-fetched text only), so the real job reuses them. */
  async function probeCaptions(id: string, durationSeconds: number): Promise<"available" | "unavailable" | "unknown"> {
    const [hit] = await ctx.db.select({ l: transcripts.language }).from(transcripts).where(eq(transcripts.youtubeId, id)).limit(1);
    if (hit) return "available";
    try {
      const got = await Promise.race([
        ctx.deps.transcripts.fetch(id, { durationSeconds }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("probe timeout")), 8000)),
      ]);
      const text = segmentsToText(got.segments);
      if (!text.trim()) return "unavailable";
      await ctx.db.insert(transcripts).values({ youtubeId: id, language: got.language, text, source: ctx.deps.transcripts.name }).onConflictDoNothing();
      return "available";
    } catch (e) {
      return e instanceof NoCaptionsError ? "unavailable" : "unknown";
    }
  }
  return r;
}
