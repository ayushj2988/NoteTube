import { eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { videos } from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import { parseIsoDuration, thumbnailUrl } from "../lib/youtube.js";

export interface VideoMeta { id: string; title: string; channel: string; duration_seconds: number; thumbnail_url: string }
export interface RawVideo { title: string; channel: string; durationSeconds: number }
export interface YouTubeClient { getVideo(id: string): Promise<RawVideo> }

const CACHE_MS = 24 * 3600_000;

export class RealYouTubeClient implements YouTubeClient {
  constructor(private apiKey: string) {}
  async getVideo(id: string): Promise<RawVideo> {
    const u = new URL("https://www.googleapis.com/youtube/v3/videos");
    u.searchParams.set("part", "snippet,contentDetails,status");
    u.searchParams.set("id", id); // id comes from our own parser (11 safe chars), never a user URL
    u.searchParams.set("key", this.apiKey);
    let res: Response;
    try { res = await fetch(u, { signal: AbortSignal.timeout(10_000) }); }
    catch { throw unavailable(); }
    if (!res.ok) {
  const details = await res.text();
  console.error("YouTube Data API error:", res.status, details);
  throw unavailable();
} // quota exhausted, key problem, outage: not the video's fault
    const body = (await res.json()) as {
      items?: { snippet: { title: string; channelTitle: string }; contentDetails: { duration: string; contentRating?: { ytRating?: string } };
        status?: { privacyStatus?: string } }[];
    };
    const item = body.items?.[0];
    if (!item) throw new AppError("VIDEO_NOT_FOUND", "We couldn't find that video.");
    if (item.status?.privacyStatus === "private" || item.contentDetails.contentRating?.ytRating === "ytAgeRestricted")
      throw new AppError("VIDEO_PRIVATE", "This video is private or restricted, so we can't read it.");
    return { title: item.snippet.title, channel: item.snippet.channelTitle, durationSeconds: parseIsoDuration(item.contentDetails.duration) };
  }
}
const unavailable = () => new AppError("AI_UNAVAILABLE", "YouTube is temporarily unavailable. Try again shortly.");

/** Metadata with a 24 h cache in Postgres. */
export async function getVideoMeta(db: Db, yt: YouTubeClient, id: string): Promise<VideoMeta> {
  const [hit] = await db.select().from(videos).where(eq(videos.youtubeId, id)).limit(1);
  if (hit && Date.now() - hit.fetchedAt.getTime() < CACHE_MS) {
    return { id, title: hit.title, channel: hit.channel, duration_seconds: hit.durationSeconds, thumbnail_url: hit.thumbnailUrl };
  }
  const raw = await yt.getVideo(id);
  const row = { youtubeId: id, title: raw.title, channel: raw.channel, durationSeconds: raw.durationSeconds, thumbnailUrl: thumbnailUrl(id), fetchedAt: new Date() };
  await db.insert(videos).values(row).onConflictDoUpdate({ target: videos.youtubeId, set: row });
  return { id, title: row.title, channel: row.channel, duration_seconds: row.durationSeconds, thumbnail_url: row.thumbnailUrl };
}

export function assertNotTooLong(meta: VideoMeta, maxMinutes: number) {
  if (meta.duration_seconds > maxMinutes * 60)
    throw new AppError("VIDEO_TOO_LONG", `Videos longer than ${maxMinutes} minutes aren't supported.`, { max_minutes: maxMinutes });
}
