const TAG = /<\/?[a-zA-Z!][^>]*>/g;

/** Strips raw HTML tags from plain strings (titles, bullets, flashcards ...). */
export const stripHtml = (s: string) => s.replace(TAG, "").replace(/\s+\n/g, "\n").trim();

/** Markdown only: strips HTML tags but leaves fenced code and `inline code` alone (generics like List<String>). */
export function sanitizeMarkdown(md: string): string {
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts.map((p, i) => (i % 2 === 1 ? p : p.replace(TAG, ""))).join("").trim();
}

const TS = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/g;

export const tsToSeconds = (h: string | undefined, m: string, s: string) => Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s);

/** Highest [mm:ss] / [h:mm:ss] marker in a text, in seconds (0 if none). */
export function maxTimestamp(text: string): number {
  let max = 0;
  for (const m of text.matchAll(TS)) max = Math.max(max, tsToSeconds(m[1], m[2]!, m[3]!));
  return max;
}

/** Removes timestamp markers everywhere ("## [03:12] Title" -> "## Title"). */
export const stripTimestamps = (md: string) => md.replace(/\[(?:\d{1,2}:)?\d{1,2}:\d{2}\]\s?/g, "");

export const formatTs = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
