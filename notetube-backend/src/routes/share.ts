import { and, eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import { notes, users } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import { videoJson } from "../services/notes.js";
import type { Ctx } from "../types.js";

/** Public, no auth. Leaks only the fields listed in the contract. */
export function shareRoutes(ctx: Ctx) {
  const r = new Hono();
  r.get("/:token", async (c) => {
    const token = c.req.param("token");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw notFound();
    const [row] = await ctx.db.select({ n: notes, author: users.name }).from(notes).innerJoin(users, eq(users.id, notes.userId))
      .where(and(eq(notes.shareToken, token), isNotNull(notes.shareToken), eq(notes.status, "ready"))).limit(1);
    if (!row) throw notFound();
    c.header("Cache-Control", "no-store");
    c.header("X-Robots-Tag", "noindex");
    const n = row.n;
    return c.json({
      title: n.title, summary: n.summary, key_concepts: n.keyConcepts, skim: n.skim, content_md: n.contentMd,
      video: videoJson({ youtube_id: n.youtubeId, video_title: n.videoTitle, video_channel: n.videoChannel, video_duration: n.videoDuration, video_thumbnail: n.videoThumbnail }),
      author_name: row.author, created_at: n.createdAt.toISOString(),
    });
  });
  return r;
}
