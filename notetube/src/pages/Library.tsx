import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { NoteSummary } from '../api/types'
import { useFolderActions, useFolders, useNotes, useTags } from '../api/queries'
import { errorText } from '../lib/errors'
import { useDebounced, useDocumentTitle } from '../lib/hooks'
import ConfirmDialog from '../ui/ConfirmDialog'
import NoteCard from '../ui/NoteCard'
import PageHeader from '../ui/PageHeader'
import { EmptyState, ErrorState, SkeletonList } from '../ui/States'
import { useToast } from '../ui/Toast'

const PAGE = 24

export default function Library() {
  useDocumentTitle('Library')
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const q = params.get('q') ?? ''
  const tag = params.get('tag') ?? ''
  const folder = params.get('folder') ?? ''
  const sort = (params.get('sort') as 'recent' | 'oldest' | 'title' | null) ?? 'recent'
  const limit = Number(params.get('n')) || PAGE
  const dq = useDebounced(q.trim(), 300)

  const notes = useNotes({ q: dq || undefined, tag: tag || undefined, folder_id: folder || undefined, sort, limit })
  const folders = useFolders()
  const tags = useTags()
  const fa = useFolderActions()

  const [adding, setAdding] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    next.delete('n')
    setParams(next, { replace: true })
  }

  const selected = folders.data?.items.find((f) => f.id === folder)
  const filtered = !!(dq || tag || folder)

  const saveFolder = (e: FormEvent) => {
    e.preventDefault()
    const name = folderName.trim()
    if (!name) return
    const done = { onSuccess: () => { setAdding(false); setRenaming(false); setFolderName('') }, onError: (err: unknown) => toast.show(errorText(err), 'error') }
    if (renaming && selected) fa.rename.mutate({ id: selected.id, name }, done)
    else
      fa.create.mutate(name, { ...done, onSuccess: (f) => { done.onSuccess(); set({ folder: f.id }) } })
  }

  const items: NoteSummary[] = notes.data?.items ?? []

  return (
    <section className="view" aria-labelledby="lib-title">
      <PageHeader id="lib-title" title="Library" sub="Every lecture you've turned into notes." />

      <div className="lib-filters gl dense">
        <div className="chips" role="group" aria-label="Folders">
          <button aria-pressed={!folder} onClick={() => set({ folder: null })}>All</button>
          <button aria-pressed={folder === 'none'} onClick={() => set({ folder: 'none' })}>Unfiled</button>
          {folders.data?.items.map((f) => (
            <button key={f.id} aria-pressed={folder === f.id} onClick={() => set({ folder: f.id })}>{f.name} <span className="mu">{f.note_count}</span></button>
          ))}
          <button className="chip-add" onClick={() => { setAdding(true); setRenaming(false); setFolderName('') }}>+ Folder</button>
        </div>
        {(adding || renaming) && (
          <form className="inline-form" onSubmit={saveFolder}>
            <label className="sr-only" htmlFor="folder-name">Folder name</label>
            <input id="folder-name" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Folder name" maxLength={40} autoFocus />
            <button className="btn dark btn-sm" type="submit" disabled={fa.create.isPending || fa.rename.isPending}>{renaming ? 'Rename' : 'Create'}</button>
            <button className="btn ghost btn-sm" type="button" onClick={() => { setAdding(false); setRenaming(false) }}>Cancel</button>
          </form>
        )}
        {selected && !renaming && (
          <div className="folder-tools">
            <button className="link" onClick={() => { setRenaming(true); setAdding(false); setFolderName(selected.name) }}>Rename “{selected.name}”</button>
            <button className="link link-danger" onClick={() => setConfirmDelete(true)}>Delete folder</button>
          </div>
        )}

        {tags.data && tags.data.items.length > 0 && (
          <div className="chips" role="group" aria-label="Tags">
            {tags.data.items.slice(0, 14).map((t) => (
              <button key={t.tag} aria-pressed={tag === t.tag} onClick={() => set({ tag: tag === t.tag ? null : t.tag })}>#{t.tag}</button>
            ))}
          </div>
        )}

        <div className="lib-row">
          <label className="lib-sort">Sort
            <select value={sort} onChange={(e) => set({ sort: e.target.value === 'recent' ? null : e.target.value })}>
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
          {filtered && <button className="link" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
          {notes.data && <span className="mu" aria-live="polite">{notes.data.total} note{notes.data.total === 1 ? '' : 's'}</span>}
        </div>
      </div>

      {notes.isPending && <SkeletonList rows={4} tall label="Loading your notes" />}
      {notes.isError && <ErrorState error={notes.error} onRetry={() => void notes.refetch()} />}
      {notes.data && items.length === 0 && (
        filtered ? (
          <EmptyState icon="⌕" title="No matching notes" body={dq ? `Nothing matches “${dq}” with these filters.` : 'No notes match these filters.'}>
            <button className="btn dark" onClick={() => setParams({}, { replace: true })}>Clear filters</button>
          </EmptyState>
        ) : (
          <EmptyState icon="✎" title="Your library is empty" body="Notes you generate are saved here.">
            <Link className="btn" to="/app/notes/new">Create your first note</Link>
          </EmptyState>
        )
      )}
      {items.length > 0 && (
        <div className="notes-grid">
          {items.map((n) => <NoteCard key={n.id} note={n} />)}
        </div>
      )}
      {notes.data && notes.data.total > items.length && (
        <div className="row"><button className="btn dark" onClick={() => { const next = new URLSearchParams(params); next.set('n', String(limit + PAGE)); setParams(next, { replace: true }) }} disabled={notes.isFetching}>Load more</button></div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${selected?.name ?? ''}”?`}
        body="The folder is removed. Its notes are kept and become unfiled."
        confirmLabel="Delete folder"
        busy={fa.remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => selected && fa.remove.mutate(selected.id, { onSuccess: () => { setConfirmDelete(false); set({ folder: null }) }, onError: (e) => toast.show(errorText(e), 'error') })}
      />
    </section>
  )
}
