// Loading, error and empty states shared by every page that loads data.
export function Loading({ label = 'Loading…' }) {
  return <p className="msg" role="status">{label}</p>
}
export function ErrorBox({ error, onRetry }) {
  return (
    <div className="msg bad" role="alert">
      <span>{error?.message || 'Something went wrong.'}</span>
      {onRetry && <button className="b o" onClick={onRetry}>Try again</button>}
    </div>
  )
}
export function Empty({ title, children }) {
  return (
    <div className="cd">
      <h2>{title}</h2>
      {children}
    </div>
  )
}
