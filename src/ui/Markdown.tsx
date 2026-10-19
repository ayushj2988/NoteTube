import { useMemo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toSeconds } from '../lib/format'

const STAMP = /\[((?:\d{1,2}:)?\d{1,2}:\d{2})\](?!\()/g

/** Turns every [mm:ss] into a link of the form #t=SECONDS so the renderer can make it a seek button. */
export function linkTimestamps(md: string): string {
  return md.replace(STAMP, (_m, t: string) => `[${t}](#t=${toSeconds(t)})`)
}

interface Props {
  source: string
  /** omit for read-only contexts (print, shared page without a player): timestamps render as plain text */
  onSeek?: (seconds: number) => void
}

/**
 * Renders model- and user-written Markdown. react-markdown does not render raw HTML, so note content
 * cannot inject markup. Only http(s) and mailto links are allowed, and they open in a new tab.
 */
export default function Markdown({ source, onSeek }: Props) {
  const text = useMemo(() => linkTimestamps(source), [source])
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }: { href?: string; children?: ReactNode }) {
            if (href?.startsWith('#t=')) {
              const secs = Number(href.slice(3))
              return onSeek ? (
                <button type="button" className="ts" onClick={() => onSeek(secs)} aria-label={`Jump to ${String(children)}`}>
                  {children}
                </button>
              ) : (
                <span className="ts-static">{children}</span>
              )
            }
            if (href && /^(https?:|mailto:)/i.test(href)) {
              return <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
            }
            return <span>{children}</span>
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
