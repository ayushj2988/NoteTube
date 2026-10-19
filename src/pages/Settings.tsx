import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useSettings, useUpdateSettings } from '../api/queries'
import type { Language, NoteStyle, Settings as S } from '../api/types'
import { errorText } from '../lib/errors'
import { downloadText } from '../lib/exportNote'
import { useDocumentTitle } from '../lib/hooks'
import ConfirmDialog from '../ui/ConfirmDialog'
import PageHeader from '../ui/PageHeader'
import { ErrorState, Skeleton } from '../ui/States'
import { useToast } from '../ui/Toast'

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="set-row">
      <div>
        <label htmlFor={id}><b>{label}</b></label>
        <p className="mu" id={`${id}-h`}>{hint}</p>
      </div>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} aria-describedby={`${id}-h`} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

export default function Settings() {
  useDocumentTitle('Settings')
  const q = useSettings()
  const update = useUpdateSettings()
  const toast = useToast()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (patch: Partial<S>) => update.mutate(patch, { onError: (e) => toast.show(`Couldn't save: ${errorText(e)}`, 'error') })

  const exportAll = async () => {
    try {
      const data = await api.exportData()
      downloadText('notetube-export.json', JSON.stringify(data, null, 2), 'application/json')
    } catch (e) {
      toast.show(errorText(e), 'error')
    }
  }

  const wipe = async () => {
    setBusy(true)
    setError('')
    try {
      await api.deleteMyData()
      qc.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' && query.queryKey[0] !== 'settings' })
      setConfirm(false)
      toast.show('All your notes, cards and study history were deleted')
      nav('/app')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const s = q.data
  return (
    <section className="view" aria-labelledby="st-title">
      <PageHeader id="st-title" title="Settings" sub="Saved to your account, so they follow you to any device." />
      {q.isPending && <Skeleton h={300} r={20} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {s && (
        <>
          <div className="gl dense set-card">
            <h2>Notes</h2>
            <div className="set-row">
              <label htmlFor="st-style"><b>Default note style</b></label>
              <select id="st-style" value={s.default_style} onChange={(e) => set({ default_style: e.target.value as NoteStyle })}>
                <option value="detailed">Detailed</option>
                <option value="concise">Concise</option>
                <option value="outline">Outline</option>
              </select>
            </div>
            <div className="set-row">
              <label htmlFor="st-lang"><b>Default language</b></label>
              <select id="st-lang" value={s.default_language} onChange={(e) => set({ default_language: e.target.value as Language })}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
            <Toggle id="st-auto" label="Create flashcards automatically" hint="New notes include flashcards unless you turn it off for that note." checked={s.auto_flashcards} onChange={(v) => set({ auto_flashcards: v })} />
          </div>

          <div className="gl dense set-card">
            <h2>Reminders and display</h2>
            <Toggle id="st-rem" label="Due-card reminders" hint="Show flashcards that are due in the bell menu and the top bar." checked={s.daily_reminder} onChange={(v) => set({ daily_reminder: v })} />
            <Toggle id="st-motion" label="Reduce motion" hint="Slows the sky to a still image and removes animations. Always on if your device asks for it." checked={s.reduce_motion} onChange={(v) => set({ reduce_motion: v })} />
          </div>

          <div className="gl dense set-card">
            <h2>Your data</h2>
            <div className="set-row">
              <div><b>Download everything</b><p className="mu">A JSON file with your notes, cards, quiz attempts and study sessions.</p></div>
              <button className="btn ghost btn-sm" onClick={() => void exportAll()}>Download</button>
            </div>
            <div className="set-row">
              <div><b>Delete my data</b><p className="mu">Removes all notes, flashcards, quizzes and study history. Your account and settings stay.</p></div>
              <button className="btn danger btn-sm" onClick={() => { setError(''); setConfirm(true) }}>Delete data</button>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title="Delete all your data?"
        body="Every note, flashcard, quiz attempt, share link and study record is permanently deleted. This can't be undone."
        confirmLabel="Delete everything"
        requireText="DELETE"
        busy={busy}
        error={error}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void wipe()}
      />
    </section>
  )
}
