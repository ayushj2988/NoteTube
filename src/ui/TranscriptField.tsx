import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { MAX_TRANSCRIPT_CHARS, MIN_TRANSCRIPT_CHARS, parseTranscript } from '../lib/transcript'

interface Props {
  value: string
  onChange: (v: string) => void
}

/** Paste text or upload .txt / .srt / .vtt. Subtitle files are converted to "[mm:ss] text" lines. */
export default function TranscriptField({ value, onChange }: Props) {
  const id = useId()
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const parsed = useMemo(() => parseTranscript(value), [value])

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileError('')
    if (file.size > 5_000_000) {
      setFileError('That file is over 5 MB. Upload a smaller transcript.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setFileError("Couldn't read that file.")
    reader.onload = () => {
      const p = parseTranscript(String(reader.result ?? ''), file.name)
      if (!p.text) {
        setFileError('No text found in that file.')
        return
      }
      setFileName(file.name)
      onChange(p.text)
    }
    reader.readAsText(file)
  }

  const tooLong = parsed.text.length > MAX_TRANSCRIPT_CHARS
  const tooShort = parsed.text.length > 0 && parsed.text.length < MIN_TRANSCRIPT_CHARS

  return (
    <div className="transcript">
      <label htmlFor={id} className="sr-only">Transcript</label>
      <textarea id={id} placeholder="Paste transcript text here…" value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="tbox-row">
        <label className="btn dark btn-file">
          Upload .txt, .srt or .vtt
          <input type="file" accept=".txt,.srt,.vtt,text/plain" className="sr-only" onChange={onFile} />
        </label>
        {fileName && <span className="mu">{fileName}</span>}
        {value && (
          <button type="button" className="link" onClick={() => { onChange(''); setFileName('') }}>Clear</button>
        )}
        {parsed.lines > 0 && !tooLong && !tooShort && (
          <span className="mu">{parsed.lines} lines · {parsed.timed ? 'timestamps found' : 'no timestamps'}</span>
        )}
      </div>
      {fileError && <p className="field-error" role="alert">{fileError}</p>}
      {tooShort && <p className="field-error" role="alert">That's very short. At least {MIN_TRANSCRIPT_CHARS} characters are needed.</p>}
      {tooLong && <p className="field-error" role="alert">That's over {MAX_TRANSCRIPT_CHARS.toLocaleString()} characters. Trim it or split it.</p>}
    </div>
  )
}
