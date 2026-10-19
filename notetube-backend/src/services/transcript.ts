import { YoutubeTranscript } from "youtube-transcript";
import { AppError } from "../lib/errors.js";
import { formatTs, tsToSeconds } from "../lib/sanitize.js";

export interface TranscriptSegment { start: number; text: string } // start in seconds
export interface FetchedTranscript { language: string; segments: TranscriptSegment[] }
export class NoCaptionsError extends Error {}

/**
 * Caption sources are unofficial and break without notice (and are often blocked from datacenter IPs),
 * so they live behind this interface. Add or swap providers without touching the pipeline.
 * Must throw NoCaptionsError when the video has no usable captions.
 */
export interface TranscriptProvider {
  readonly name: string;
  fetch(youtubeId: string, opts: { language?: string; durationSeconds?: number }): Promise<FetchedTranscript>;
}

export class YoutubeCaptionProvider implements TranscriptProvider {
  readonly name = "youtube-captions";
  async fetch(id: string, opts: { language?: string; durationSeconds?: number }): Promise<FetchedTranscript> {
    let items: { text: string; offset: number; lang?: string }[];
    try {
      items = await YoutubeTranscript.fetchTranscript(id, opts.language ? { lang: opts.language } : undefined);
    } catch (e) {
      const n = (e as Error).constructor?.name ?? "";
      // disabled / not available / language missing: try the default language once, otherwise no captions
      if (opts.language && /NotAvailableLanguage/.test(n)) return this.fetch(id, { durationSeconds: opts.durationSeconds });
      if (/Disabled|NotAvailable|VideoUnavailable/.test(n)) throw new NoCaptionsError(n);
      throw e; // rate limited / network: let the caller decide
    }
    if (!items.length) throw new NoCaptionsError("empty");
    // The library returns milliseconds from one caption format and seconds from the other.
    const max = Math.max(...items.map((i) => i.offset));
    const looksLikeMs = opts.durationSeconds ? max > opts.durationSeconds * 1.5 : items.every((i) => Number.isInteger(i.offset)) && max > 20_000;
    const div = looksLikeMs ? 1000 : 1;
    return { language: items[0]!.lang ?? opts.language ?? "en", segments: items.map((i) => ({ start: i.offset / div, text: i.text })) };
  }
}

/** Tries each provider in order; the first that returns captions wins. */
export class ChainProvider implements TranscriptProvider {
  readonly name = "chain";
  constructor(private providers: TranscriptProvider[]) {}
  async fetch(id: string, opts: { language?: string; durationSeconds?: number }) {
    let last: unknown = new NoCaptionsError("no providers");
    for (const p of this.providers) {
      try { return await p.fetch(id, opts); } catch (e) { last = e; }
    }
    throw last;
  }
}

/** Merge raw caption segments into ~20 s lines: "[mm:ss] text". Keeps token usage and noise down. */
export function segmentsToText(segments: TranscriptSegment[], chunkSeconds = 20): string {
  const lines: string[] = [];
  let start = 0, buf: string[] = [], open = false;
  for (const s of segments) {
    if (!open) { start = s.start; open = true; }
    buf.push(s.text.replace(/\s+/g, " ").trim());
    if (s.start - start >= chunkSeconds) { lines.push(`[${formatTs(start)}] ${buf.join(" ")}`); buf = []; open = false; }
  }
  if (buf.length) lines.push(`[${formatTs(start)}] ${buf.join(" ")}`);
  return lines.join("\n");
}

const LINE = /^\s*\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*(.*)$/;

/** Normalises user-pasted text: optional [mm:ss] prefixes are kept (re-formatted), everything else is plain text. */
export function parseUserTranscript(raw: string): { text: string; hasTimestamps: boolean; plainLength: number } {
  const out: string[] = [];
  let hasTimestamps = false, plainLength = 0;
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(LINE);
    if (m) {
      hasTimestamps = true;
      plainLength += m[4]!.length;
      out.push(`[${formatTs(tsToSeconds(m[1], m[2]!, m[3]!))}] ${m[4]}`);
    } else { plainLength += t.length; out.push(t); }
  }
  return { text: out.join("\n"), hasTimestamps, plainLength };
}

export const MIN_TRANSCRIPT_CHARS = 200;
export function assertTranscriptLongEnough(plainLength: number) {
  if (plainLength < MIN_TRANSCRIPT_CHARS)
    throw new AppError("TRANSCRIPT_TOO_SHORT", "That transcript is too short to make good notes from.");
}
