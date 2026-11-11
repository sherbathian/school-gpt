import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'
import SchoolWorkspace from './SchoolWorkspace.jsx'
import './App.css'

function App() {
  const [page, setPage] = useState({ status: 'loading' })
  const [apiStatus, setApiStatus] = useState('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSession() {
      try {
        const healthResponse = await apiRequest('/api/health', { signal: controller.signal })
        setApiStatus(healthResponse.ok ? 'ready' : 'unavailable')

        const sessionResponse = await apiRequest('/api/me', { signal: controller.signal })
        if (sessionResponse.ok) {
          const { data } = await sessionResponse.json()
          setPage({ status: 'signed-in', user: data })
        } else if (sessionResponse.status === 401) {
          setPage({ status: 'guest' })
        } else {
          setPage({ status: 'error' })
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiStatus('unavailable')
          setPage({ status: 'error' })
        }
      }
    }

    loadSession()
    return () => controller.abort()
  }, [])

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const csrfResponse = await apiRequest('/sanctum/csrf-cookie')
      if (!csrfResponse.ok) throw new Error('Could not start a secure sign-in session.')

      const response = await apiRequest('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = result.errors?.email?.[0]
        throw new Error(message || 'We couldn’t sign you in. Check your details and try again.')
      }

      if (!result.data) throw new Error('The sign-in service returned an unexpected response.')

      setPage({ status: 'signed-in', user: result.data })
      setPassword('')
    } catch (loginError) {
      setError(loginError.message || 'We couldn’t reach the sign-in service. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setError('')
    try {
      const response = await apiRequest('/api/logout', {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Sign out failed')
      setPage({ status: 'guest' })
    } catch {
      setError('We couldn’t sign you out. Check your connection and try again.')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Schoolhouse home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Schoolhouse</span>
        </a>
        <span className="milestone-label">School workspace</span>
      </header>

      {page.status === 'loading' ? (
        <p className="loading-message" role="status">Checking your session…</p>
      ) : null}

      {page.status === 'guest' ? (
        <section className="auth-layout" aria-labelledby="welcome-title">
          <div className="welcome-copy">
            <p className="eyebrow">Your school, in one place</p>
            <h1 id="welcome-title">A clearer way to run your school.</h1>
            <p className="intro">
              Sign in to your school workspace to manage the people and details
              that keep each school moving.
            </p>
            <p className={`api-status api-${apiStatus}`} role="status">
              <span className="status-dot" aria-hidden="true" />
              {apiStatus === 'ready' ? 'School system is ready' : 'School system is not reachable'}
            </p>
          </div>

          <form className="auth-card" onSubmit={handleLogin}>
            <div className="form-heading">
              <p className="eyebrow">Welcome back</p>
              <h2>Sign in</h2>
              <p>Use the email and password provided by your school.</p>
            </div>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <label className="remember-option">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>Keep me signed in</span>
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="access-note">Need access? Ask your school administrator to set up your account.</p>
          </form>
        </section>
      ) : null}

      {page.status === 'signed-in' ? (
        <SchoolWorkspace user={page.user} onLogout={handleLogout} />
      ) : null}

      {page.status === 'signed-in' && error ? <p className="form-error" role="alert">{error}</p> : null}

      {page.status === 'error' ? (
        <p className="loading-message" role="alert">Can’t reach the school system. Start the Laravel server and refresh.</p>
      ) : null}

      <footer>Built step by step for the people who keep schools moving.</footer>
    </main>
  )
}

export default App
