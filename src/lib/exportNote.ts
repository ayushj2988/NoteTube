import type { Note } from '../api/types'
import { formatTimestamp, toSeconds } from './format'

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'note'
}

const STAMP = /\[((?:\d{1,2}:)?\d{1,2}:\d{2})\](?!\()/g

/** A self-contained Markdown copy of a note. [mm:ss] markers become links that open the video at that moment. */
export function noteToMarkdown(n: Note): string {
  const out: string[] = [`# ${n.title}`, '']
  const meta = [n.video?.channel, n.video ? formatTimestamp(n.video.duration_seconds) : null, n.subject].filter(Boolean)
  if (meta.length) out.push(`*${meta.join(' · ')}*`, '')
  if (n.video) out.push(`Source: https://www.youtube.com/watch?v=${n.video.id}`, '')
  if (n.summary) out.push('## Summary', '', n.summary, '')
  if (n.key_concepts.length) out.push('## Key concepts', '', ...n.key_concepts.map((k) => `- ${k}`), '')
  if (n.skim.length) out.push('## In 30 seconds', '', ...n.skim.map((s) => `- ${s}`), '')
  const body = n.video
    ? n.content_md.replace(STAMP, (_m, t: string) => `[${t}](https://youtu.be/${n.video!.id}?t=${toSeconds(t)})`)
    : n.content_md
  out.push('## Notes', '', body.trim(), '')
  return out.join('\n')
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
