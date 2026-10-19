export const MAX_TRANSCRIPT_CHARS = 400_000
export const MIN_TRANSCRIPT_CHARS = 200

export interface ParsedTranscript {
  /** one cue or paragraph per line; lines start with [mm:ss] when the source had timing */
  text: string
  lines: number
  timed: boolean
}

function stamp(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return h ? `[${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]` : `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`
}

function cueStart(line: string): number | null {
  const m = line.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->/)
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

/** Parses .srt / .vtt into "[mm:ss] text" lines. Anything else is returned trimmed and untouched. */
export function parseTranscript(raw: string, filename = ''): ParsedTranscript {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const isCue = /\.(srt|vtt)$/i.test(filename) || /^WEBVTT/.test(text) || /\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/.test(text.slice(0, 2000))
  if (!isCue) {
    const out = text.trim()
    return { text: out, lines: out ? out.split('\n').filter(Boolean).length : 0, timed: /\[\d{1,2}:\d{2}/.test(out) }
  }
  const out: string[] = []
  let start: number | null = null
  let buf: string[] = []
  const flush = () => {
    if (start !== null && buf.length) out.push(`${stamp(start)} ${buf.join(' ')}`)
    start = null
    buf = []
  }
  for (const line of text.split('\n')) {
    const t = line.trim()
    const s = cueStart(t)
    if (s !== null) {
      flush()
      start = s
    } else if (!t) {
      flush()
    } else if (start !== null) {
      buf.push(t.replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, ''))
    }
  }
  flush()
  return { text: out.join('\n'), lines: out.length, timed: true }
}
