import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [health, setHealth] = useState({ state: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function loadHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal })
        if (!response.ok) throw new Error('Health check failed')
        const result = await response.json()
        setHealth({ state: result.status === 'ok' ? 'ready' : 'degraded' })
      } catch {
        if (!controller.signal.aborted) setHealth({ state: 'offline' })
      }
    }

    loadHealth()
    return () => controller.abort()
  }, [])

  const messages = {
    loading: 'Checking the application…',
    ready: 'API and database are connected.',
    degraded: 'The API is responding, but a service needs attention.',
    offline: 'Can’t reach the API. Start the Laravel server and try again.',
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Schoolhouse home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Schoolhouse</span>
        </a>
        <span className="milestone-label">Project setup</span>
      </header>
      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">Your school, in one place</p>
        <h1 id="welcome-title">A clearer way to run your school.</h1>
        <p className="intro">
          We’re setting up the foundation first. Soon, you’ll be able to manage
          students, staff, classes, and fees from one simple workspace.
        </p>
        <div className={`status-card status-${health.state}`} role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>{messages[health.state]}</span>
        </div>
      </section>
      <section className="next-step" aria-label="What comes next">
        <span className="step-number">01</span>
        <div>
          <h2>Start with the basics</h2>
          <p>Next, we’ll add secure sign-in and school membership.</p>
        </div>
        <span className="step-arrow" aria-hidden="true">→</span>
      </section>
      <footer>Built step by step for the people who keep schools moving.</footer>
    </main>
  )
}

export default App
