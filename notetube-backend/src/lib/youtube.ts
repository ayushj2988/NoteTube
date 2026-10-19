import { AppError } from "./errors.js";

const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const ID = /^[A-Za-z0-9_-]{11}$/;

/** Parses a user-supplied URL and returns the 11-character video id. Never fetches the URL itself (SSRF). */
export function parseYoutubeUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw invalid(); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw invalid();
  if (!HOSTS.has(u.hostname.toLowerCase())) throw invalid();
  let id: string | null = null;
  if (u.hostname.toLowerCase() === "youtu.be") {
    id = u.pathname.split("/")[1] ?? null;
  } else if (u.pathname === "/watch") {
    id = u.searchParams.get("v");
  } else {
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
    id = m ? m[2]! : null;
  }
  if (!id || !ID.test(id)) throw invalid();
  return id;
}

const invalid = () => new AppError("INVALID_URL", "That doesn't look like a YouTube video link.");

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const thumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** "PT1H2M3S" -> seconds */
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, mi, s] = m.map((x) => (x ? Number(x) : 0));
  return d! * 86400 + h! * 3600 + mi! * 60 + s!;
}
