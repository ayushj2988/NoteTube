import { Component } from 'react'

// If any page crashes, show this instead of a blank white screen. "Back to dashboard" does a full reload, which clears the crash.
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="nf">
        <div className="card c3">
          <span className="bd">Something broke</span>
          <h2>This page hit an error.</h2>
          <p>{String(this.state.error?.message || this.state.error)}</p>
          <a className="bt" href="/dashboard">Back to dashboard</a>
        </div>
      </main>
    )
  }
}
