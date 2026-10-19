import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useCreateNote, usePreviewVideo, useSettings, useUsage } from '../api/queries'
import type { CreateNoteInput, Language, NoteStyle, VideoPreview } from '../api/types'
import { errorText, fieldErrors, friendlyMessage } from '../lib/errors'
import { formatTimestamp, relativeTime } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { MAX_TRANSCRIPT_CHARS, MIN_TRANSCRIPT_CHARS } from '../lib/transcript'
import { isYouTubeUrl } from '../lib/youtube'
import PageHeader from '../ui/PageHeader'
import { FieldError } from '../ui/States'
import TranscriptField from '../ui/TranscriptField'
import UsageMeter from '../ui/UsageMeter'

const STYLES: { id: NoteStyle; label: string }[] = [
  { id: 'detailed', label: 'Detailed' },
  { id: 'concise', label: 'Concise' },
  { id: 'outline', label: 'Outline' },
]
const LANGS: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
  { id: 'hinglish', label: 'Hinglish' },
]

function previewProblem(e: unknown): string {
  if (e instanceof ApiError && e.code === 'VIDEO_TOO_LONG') {
    const max = Number(e.details?.max_minutes)
    return max ? `That video is longer than the ${max} minute limit. Paste its transcript instead.` : friendlyMessage('VIDEO_TOO_LONG')
  }
  return errorText(e)
}

function quotaProblem(e: ApiError): string {
  const d = e.details as { limit?: number; resets_at?: string } | undefined
  return d?.limit
    ? `You've used all ${d.limit} generations for today. They reset ${d.resets_at ? relativeTime(d.resets_at) : 'tomorrow'}.`
    : friendlyMessage('QUOTA_EXCEEDED')
}

const CAPTION_TEXT: Record<VideoPreview['captions'], string> = {
  available: 'Captions found',
  unavailable: 'No captions found. We will try to read the video itself. If that fails, paste a transcript.',
  unknown: 'Captions will be checked when you generate.',
}

export default function NewNote() {
  useDocumentTitle('New note')
  const nav = useNavigate()
  const init = (useLocation().state ?? {}) as { url?: string; transcript?: string }
  const settings = useSettings().data
  const usage = useUsage().data
  const preview = usePreviewVideo()
  const create = useCreateNote()

  const [url, setUrl] = useState(init.url ?? '')
  const [transcript, setTranscript] = useState(init.transcript ?? '')
  const [showTranscript, setShowTranscript] = useState(!!init.transcript)
  const [title, setTitle] = useState('')
  const [style, setStyle] = useState<NoteStyle>('detailed')
  const [language, setLanguage] = useState<Language>('en')
  const [flashcards, setFlashcards] = useState(true)
  const [quiz, setQuiz] = useState(true)
  const [timestamps, setTimestamps] = useState(true)
  const [video, setVideo] = useState<VideoPreview | null>(null)
  const [urlError, setUrlError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  // account defaults apply once, as soon as they have loaded
  const applied = useRef(false)
  useEffect(() => {
    if (!settings || applied.current) return
    applied.current = true
    setStyle(settings.default_style)
    setLanguage(settings.default_language)
    setFlashcards(settings.auto_flashcards)
  }, [settings])

  const latestUrl = useRef(url)
  latestUrl.current = url.trim()

  const fetchLecture = (e?: FormEvent) => {
    e?.preventDefault()
    const u = url.trim()
    setVideo(null)
    setFields({})
    if (!u) return setUrlError('Paste a YouTube link first.')
    if (!isYouTubeUrl(u)) return setUrlError(friendlyMessage('INVALID_URL'))
    setUrlError('')
    preview.mutate(u, {
      onSuccess: (v) => latestUrl.current === u && setVideo(v),
      onError: (err) => latestUrl.current === u && setUrlError(previewProblem(err)),
    })
  }

  // arriving from Home with a link already typed: look it up straight away
  const auto = useRef(false)
  useEffect(() => {
    if (auto.current) return
    auto.current = true
    if (isYouTubeUrl(init.url ?? '')) fetchLecture()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const out = !!usage && usage.used >= usage.limit

  const submit = () => {
    const u = url.trim()
    const t = transcript.trim()
    const f: Record<string, string> = {}
    if (!u && !t) f.url = 'Paste a YouTube link or a transcript.'
    if (u && !isYouTubeUrl(u)) f.url = friendlyMessage('INVALID_URL')
    if (!u && t && !title.trim()) f.title = 'Give this note a title.'
    if (t && t.length < MIN_TRANSCRIPT_CHARS) f.transcript_text = `The transcript needs at least ${MIN_TRANSCRIPT_CHARS} characters.`
    if (t.length > MAX_TRANSCRIPT_CHARS) f.transcript_text = `The transcript is over ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters.`
    setFields(f)
    setFormError('')
    if (Object.keys(f).length) return
    const body: CreateNoteInput = {
      ...(u ? { url: u } : {}),
      ...(t ? { transcript_text: t } : {}),
      ...(title.trim() ? { title: title.trim() } : {}),
      style,
      language,
      include: { flashcards, quiz, timestamps },
    }
    create.mutate(body, {
      onSuccess: (note) => nav(`/app/notes/${note.id}`, { replace: true }),
      onError: (err) => {
        const fe = fieldErrors(err)
        if (Object.keys(fe).length) setFields(fe)
        else if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') setFormError(quotaProblem(err))
        else setFormError(errorText(err))
      },
    })
  }

  const noUrl = !url.trim()
  return (
    <section className="view" aria-labelledby="new-title">
      <Link className="back" to="/app">← Back</Link>
      <PageHeader id="new-title" title={<>New note from <span>YouTube.</span></>} sub="Paste a lecture link and we'll build your notes." />

      <form className="gl dense hero" onSubmit={fetchLecture} noValidate>
        <label className="sr-only" htmlFor="yt-url">YouTube link</label>
        <div className="urlrow">
          <input
            id="yt-url"
            placeholder="https://youtube.com/watch?v=…"
            value={url}
            inputMode="url"
            autoFocus={!init.url}
            aria-invalid={!!(urlError || fields.url)}
            aria-describedby="yt-err"
            onChange={(e) => { setUrl(e.target.value); setVideo(null); setUrlError(''); setFields((f) => ({ ...f, url: '' })) }}
          />
          <button className="btn" type="submit" disabled={preview.isPending}>{preview.isPending ? 'Looking…' : 'Fetch lecture'}</button>
        </div>
        <p id="yt-err" className="nerr" role="alert">{urlError || fields.url}</p>

        {video && (
          <div className="gl pv" aria-live="polite">
            <img src={video.video.thumbnail_url} alt="" width={160} height={90} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            <div>
              <b>{video.video.title}</b>
              <p className="mu">{video.video.channel} · {formatTimestamp(video.video.duration_seconds)}</p>
              <p className="mu pv-cap" data-captions={video.captions}>{CAPTION_TEXT[video.captions]}</p>
            </div>
          </div>
        )}

        <button type="button" className="link" aria-expanded={showTranscript} onClick={() => setShowTranscript((v) => !v)}>
          {showTranscript ? '− Hide transcript' : '+ Or paste / upload a transcript'}
        </button>
        {showTranscript && <TranscriptField value={transcript} onChange={setTranscript} />}
        <FieldError>{fields.transcript_text}</FieldError>
      </form>

      <div className="gl dense hero opts">
        <h2>Note options</h2>

        {noUrl && (
          <label className="field">
            Title (needed when there is no link)
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fields.title} />
            <FieldError>{fields.title}</FieldError>
          </label>
        )}

        <p className="mu">Style</p>
        <div className="chips" role="group" aria-label="Note style">
          {STYLES.map((s) => <button key={s.id} type="button" aria-pressed={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</button>)}
        </div>

        <p className="mu" style={{ marginTop: 14 }}>Also create</p>
        <label className="tg"><span>Flashcards</span><input type="checkbox" checked={flashcards} onChange={(e) => setFlashcards(e.target.checked)} /></label>
        <label className="tg"><span>Quiz questions</span><input type="checkbox" checked={quiz} onChange={(e) => setQuiz(e.target.checked)} /></label>
        <label className="tg"><span>Clickable timestamps</span><input type="checkbox" checked={timestamps} onChange={(e) => setTimestamps(e.target.checked)} /></label>

        <div className="row start gen-row">
          <button className="btn" type="button" onClick={submit} disabled={create.isPending || out}>
            {create.isPending ? 'Starting…' : 'Generate notes'}
          </button>
          <label className="sr-only" htmlFor="lang">Language</label>
          <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        {formError && <p className="field-error" role="alert">{formError}</p>}
        {out && !formError && <p className="field-error" role="alert">{friendlyMessage('QUOTA_EXCEEDED')} They reset {usage ? relativeTime(usage.resets_at) : 'tomorrow'}.</p>}
        <UsageMeter />
      </div>
    </section>
  )
}
