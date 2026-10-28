import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main id="main" className="nf">
      <div className="card c3">
        <span className="bd">404</span>
        <h2>That page is not here.</h2>
        <p>The link may be old, or the note was deleted.</p>
        <Link className="bt" to="/">Back to notetube</Link>
      </div>
    </main>
  )
}
