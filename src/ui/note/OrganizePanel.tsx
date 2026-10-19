import { useEffect, useState, type KeyboardEvent } from 'react'
import type { Note } from '../../api/types'
import { useFolders, useUpdateNote } from '../../api/queries'
import { errorText } from '../../lib/errors'
import { useToast } from '../Toast'

const MAX_TAGS = 12

/** Folder, subject and tags for one note. Each change saves immediately. */
export default function OrganizePanel({ note }: { note: Note }) {
  const update = useUpdateNote(note.id)
  const folders = useFolders()
  const toast = useToast()
  const [subject, setSubject] = useState(note.subject ?? '')
  const [tag, setTag] = useState('')
  useEffect(() => setSubject(note.subject ?? ''), [note.subject])

  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch, { onError: (e) => toast.show(errorText(e), 'error') })

  const addTag = () => {
    const t = tag.trim().toLowerCase().replace(/^#/, '').slice(0, 32)
    setTag('')
    if (!t || note.tags.includes(t)) return
    if (note.tags.length >= MAX_TAGS) return toast.show(`A note can have up to ${MAX_TAGS} tags.`, 'error')
    save({ tags: [...note.tags, t] })
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="gl dense org-panel">
      <h2>Organize</h2>
      <label className="field">
        Folder
        <select value={note.folder_id ?? ''} onChange={(e) => save({ folder_id: e.target.value || null })}>
          <option value="">Unfiled</option>
          {folders.data?.items.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label className="field">
        Subject
        <input
          value={subject}
          maxLength={60}
          placeholder="e.g. Algorithms"
          onChange={(e) => setSubject(e.target.value)}
          onBlur={() => subject.trim() !== (note.subject ?? '') && save({ subject: subject.trim() || null })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>
      <div className="field">
        <label htmlFor="tag-input">Tags</label>
        <div className="tag-edit">
          {note.tags.map((t) => (
            <span key={t} className="tag-chip">
              #{t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => save({ tags: note.tags.filter((x) => x !== t) })}>×</button>
            </span>
          ))}
          <input id="tag-input" value={tag} placeholder={note.tags.length ? 'Add tag' : 'Add a tag and press Enter'} maxLength={32} onChange={(e) => setTag(e.target.value)} onKeyDown={onKey} onBlur={addTag} />
        </div>
      </div>
    </div>
  )
}
