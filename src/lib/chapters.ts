import { toSeconds } from './format'

export interface Chapter {
  seconds: number
  stamp: string
  title: string
}

const HEADING = /^#{2,3}\s*\[((?:\d{1,2}:)?\d{1,2}:\d{2})\]\s*[-–—:]?\s*(.+?)\s*$/gm

/** Chapters are "## [mm:ss] Title" headings in content_md (see docs/API.md). */
export function parseChapters(md: string): Chapter[] {
  const out: Chapter[] = []
  for (const m of md.matchAll(HEADING)) out.push({ stamp: m[1], seconds: toSeconds(m[1]), title: m[2].replace(/[*_`]/g, '') })
  return out
}
