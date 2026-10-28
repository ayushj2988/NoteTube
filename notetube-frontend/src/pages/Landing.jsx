import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { useScene } from '../scene/SceneContext.jsx'
import UserMenu from '../components/UserMenu.jsx'

const SUBJECTS = ['Computer Science', 'Math', 'Biology', 'Economics', 'Chemistry', 'Physics', 'History', 'Law', 'Medicine', 'Design']
const LABELS = ['Raw transcript', 'Notes', 'Flashcards']
const FAQ = [
  ['Does it work with any YouTube video?', 'It needs a public video. If the captions are off, you can paste the transcript yourself.'],
  ['Do I need an account?', 'Yes, so your notes, flashcards and progress are saved and follow you to any device.'],
  ['Can I edit the notes?', 'Yes. Edit, highlight and add your own notes.'],
  ['Is it free?', 'Yes. NoteTube is free to use.'],
  ['Does it work on my phone?', 'Yes. The whole app is built to work on small screens.'],
  ['Where do the notes come from?', 'They are written by AI from the lecture, with timestamps that jump back to the video. Check anything important against the source.'],
]
const BARS = [['90%', ''], ['70%', 'h'], ['85%', ''], ['55%', ''], ['75%', 'h'], ['60%', '']]
const Lines = () => <div className="mk">{BARS.map(([w, c], i) => <i key={i} className={c} style={{ width: w }} />)}</div>

// The landing page. The dots (the fixed canvas behind the site) move into the hero frame and loop:
// loose transcript, then notes, then flashcards.
export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const scene = useScene()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(-1)
  const [level, setLevel] = useState(0)
  const stage = useRef(null)
  const wrap = useRef(null)

  // the hero frame starts tilted back and settles flat as you scroll; the dots tilt with it
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    scene.state.stageEl = stage.current
    const onScroll = () => {
      if (reduce || !wrap.current || !stage.current) return
      const prog = Math.min(1, Math.max(0, (innerHeight - wrap.current.getBoundingClientRect().top) / (innerHeight * 0.8)))
      stage.current.style.transform = `scale(${0.9 + 0.1 * prog}) rotateX(${25 * (1 - prog)}deg)`
      scene.state.tilt = (25 * (1 - prog) * Math.PI) / 180
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    // the labels under the frame follow what the dots are showing
    const t = setInterval(() => setLevel((l) => (l === scene.state.level ? l : scene.state.level)), 200)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      clearInterval(t)
      scene.state.stageEl = null
      scene.state.tilt = 0
    }
  }, [scene])

  const submit = (e) => {
    e.preventDefault()
    setBusy(true)
    scene.pulse(1900)
    // the link waits in this tab until the person is logged in, then the dashboard fills it in
    try { sessionStorage.setItem('nt_pending_url', url.trim()) } catch { /* ignore */ }
    setTimeout(() => navigate(user ? '/dashboard' : '/signup'), 700)
  }
  const start = user ? '/dashboard' : '/signup'

  return (
    <div className={'pg' + (menu ? ' mo' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <nav className="top" aria-label="Main">
        <div className="nv">
          <Link className="lg0" to="/">notetube</Link>
          <a className="l" href="#benefits">Benefits</a>
          <a className="l" href="#how">How it works</a>
          <a className="l" href="#faq">FAQ</a>
          <div className="rt0">
            {user ? (
              <><Link className="bt" to="/dashboard">Open app</Link><UserMenu /></>
            ) : (
              <><Link className="l" to="/login">Log in</Link><Link className="bt" to="/signup">Start Now</Link></>
            )}
          </div>
          <button id="mb" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? '×' : '≡'}</button>
        </div>
      </nav>

      <main id="main">
        <section className="sec" id="top" style={{ paddingTop: 60 }}>
          <div className="in">
            <div className="hc">
              <span className="bd">YouTube lectures → study notes</span>
              <h1>Turn any lecture into notes you’ll actually read.</h1>
              <p>Paste a YouTube link. NoteTube writes the notes first. Add flashcards and a quiz whenever you want them.</p>
              <div className="ctas">
                <Link className="bt" to={start}>Make my notes →</Link>
                <a className="bt alt" href="#how">See how it works</a>
              </div>
            </div>
            <div className="tw" ref={wrap}>
              <div className="stage" ref={stage}>
                <div className="tb0"><i /><i /><i /><span>notetube.app / how-hash-tables-work</span></div>
                <div className="lbs" aria-hidden="true">{LABELS.map((l, i) => <span key={l} className={'bd' + (i === level ? ' on' : '')}>{l}</span>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="problem">
          <div className="in">
            <div className="lh"><h2>Sound familiar?</h2></div>
            <div className="g3">
              <div className="card c1"><h3>The lecture is 54 minutes. The idea is 5.</h3><p>You pause, rewind and type, just to catch one definition.</p></div>
              <div className="card c2"><h3>Your notes are a mess.</h3><p>Half sentences, no timestamps, no way to find that one example.</p></div>
              <div className="card c3"><h3>By Friday it is gone.</h3><p>Watching feels like learning. Then the exam shows up.</p></div>
            </div>
          </div>
        </section>

        <section className="sec" id="benefits">
          <div className="in">
            <div className="lh"><span className="bd">Benefits</span><h2>Everything a notes app should do</h2><p>Built around how students actually study.</p></div>
            <div className="bn">
              <div className="card c1 s2"><span className="bd">Notes</span><h3>Notes in minutes</h3><p>Headings, definitions and key points, written from the lecture.</p><Lines /></div>
              <div className="card c2"><span className="bd">Timestamps</span><h3>Click, jump, rewatch</h3><p>Every note links to the exact moment in the video.</p></div>
              <div className="card c3"><span className="bd">Flashcards</span><h3>They come back</h3><p>Miss a card and it returns until it sticks.</p></div>
              <div className="card c2 s2"><span className="bd">Quizzes</span><h3>Quizzes that explain</h3><p>Every answer comes with why it is right.</p><div className="mk"><i style={{ width: '80%' }} /><i className="h" style={{ width: '55%' }} /><i style={{ width: '65%' }} /><i style={{ width: '45%' }} /></div></div>
              <div className="card c1 s2"><span className="bd">Edit</span><h3>Make it yours</h3><p>Edit, highlight and add your own notes.</p></div>
              <div className="card c3"><span className="bd">Progress</span><h3>See weak spots</h3><p>Streaks and a study heatmap.</p></div>
            </div>
          </div>
        </section>

        <section className="sec" id="subjects">
          <div className="in">
            <div className="lh"><h2>Works for every subject</h2></div>
            {[false, true].map((rv) => (
              <div className={'mq' + (rv ? ' rv' : '')} key={String(rv)}>
                {[0, 1].map((k) => <div className="mt" key={k} aria-hidden={k ? 'true' : undefined}>{SUBJECTS.map((s) => <span className="ch" key={s}>{s}</span>)}</div>)}
              </div>
            ))}
          </div>
        </section>

        <section className="sec" id="how">
          <div className="in">
            <div className="lh"><span className="bd">How it works</span><h2>Three steps. No rewinding.</h2></div>
            <div className="hw">
              <div className="tx"><span className="bd">Step 1</span><h2>Paste a link</h2><p>Drop in any YouTube lecture. NoteTube reads it and starts writing.</p><Link className="bt alt" to={start}>Try it →</Link></div>
              <div className="vis" style={{ background: 'var(--mint)' }}><div className="mk"><div className="fcm" style={{ justifyContent: 'flex-start', background: '#fff', boxShadow: 'none', fontWeight: 500, textTransform: 'none' }}>youtube.com/watch?v=…</div><i className="h" style={{ width: '70%', height: 14 }} /><i style={{ width: '40%' }} /></div></div>
            </div>
            <div className="arw" aria-hidden="true">↓</div>
            <div className="hw rev">
              <div className="tx"><span className="bd">Step 2</span><h2>Read, click, jump</h2><p>Clean notes with timestamps. Highlight what matters, skip what does not.</p><Link className="bt alt" to={start}>Try it →</Link></div>
              <div className="vis" style={{ background: 'var(--pe)' }}><Lines /></div>
            </div>
            <div className="arw" aria-hidden="true">↓</div>
            <div className="hw">
              <div className="tx"><span className="bd">Step 3</span><h2>Practise until it sticks</h2><p>Flashcards and quizzes built from the same notes, with a heatmap to track you.</p><Link className="bt alt" to={start}>Try it →</Link></div>
              <div className="vis" style={{ background: 'var(--y)' }}>
                <div className="mk"><div className="fcm">How are collisions handled?</div><i style={{ width: '40%' }} /></div>
                <div className="mk"><div className="hm" style={{ gap: 4 }}>{'0123012301230123012301230123'.split('').map((c, i) => <i key={i} className={c === '0' ? '' : 'l' + c} style={{ width: 14, height: 14 }} />)}</div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="faq">
          <div className="in">
            <div className="lh"><h2>Questions</h2></div>
            <div className="fq">
              {FAQ.map(([q, a], i) => (
                <div className={'fi' + (open === i ? ' open' : '')} key={q}>
                  <button className="q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}><span>{q}</span><b>+</b></button>
                  <div className="fa"><div><p>{a}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" id="start">
          <div className="in">
            <div className="pn">
              <div className="lh"><h2>Ready to try your first lecture?</h2></div>
              <form onSubmit={submit}>
                <label className="sr" htmlFor="cl">YouTube link</label>
                <input id="cl" type="url" required placeholder="Paste a YouTube link" value={url} onChange={(e) => setUrl(e.target.value)} />
                <button className="bt" type="submit" disabled={busy}>{busy ? 'One moment…' : 'Make notes'}</button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="ft">
        <div className="fo">
          <Link className="lg0 ft0" to="/">notetube</Link>
          <nav aria-label="Footer"><a href="#benefits">Benefits</a><a href="#how">How it works</a><a href="#faq">FAQ</a>{!user && <Link to="/login">Log in</Link>}</nav>
          <span>© 2026 NoteTube. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
