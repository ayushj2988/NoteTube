import { NOTES } from '../lib/data'

interface Props {
  indices: number[]
  onOpen: (index: number) => void
}

export default function NoteList({ indices, onOpen }: Props) {
  return (
    <div className="recent">
      {indices.map((i) => {
        const n = NOTES[i]
        return (
          <button key={n.title} className="gl lift rn" onClick={() => onOpen(i)}>
            <div className="th" style={{ background: n.color }}><small>{n.duration}</small></div>
            <div>
              <b>{n.title}</b>
              <span>{n.meta}</span>
              <br />
              <i className="tag">{n.tag}</i>
            </div>
          </button>
        )
      })}
    </div>
  )
}
