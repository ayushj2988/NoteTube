import { memo } from 'react'
import Markdown from '../Markdown'

interface Props {
  summary: string | null
  concepts: string[]
  md: string
  onSeek?: (seconds: number) => void
}

/** The readable part of a note: summary, key concepts, then the Markdown body. Shared by the reader, the public page and print. */
function NoteBody({ summary, concepts, md, onSeek }: Props) {
  return (
    <>
      {summary && <p className="lede">{summary}</p>}
      {concepts.length > 0 && (
        <>
          <h3>Key concepts</h3>
          <ul className="concepts" aria-label="Key concepts">
            {concepts.map((k) => <li key={k} className="kc">{k}</li>)}
          </ul>
        </>
      )}
      <Markdown source={md} onSeek={onSeek} />
    </>
  )
}
export default memo(NoteBody)
