import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || Object.values(result.errors || {}).flat()[0] || 'That request could not be completed.')
  return result.data
}

export default function SchoolSessions({ school, canManage }) {
  const [sessions, setSessions] = useState([])
  const [title, setTitle] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    apiRequest(`/api/schools/${school.id}/sessions`)
      .then(readData)
      .then((data) => { if (active) setSessions(data) })
      .catch((requestError) => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [school.id])

  async function createSession(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await readData(await apiRequest(`/api/schools/${school.id}/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, starts_on: startsOn, ends_on: endsOn }),
      }))
      setSessions((current) => [...current.map((item) => session.is_current
        ? { ...item, is_current: false, current_marker: null }
        : item), session].sort((left, right) => right.starts_on.localeCompare(left.starts_on)))
      setTitle('')
      setStartsOn('')
      setEndsOn('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function makeCurrent(session) {
    setError('')
    try {
      const updated = await readData(await apiRequest(`/api/schools/${school.id}/sessions/${session.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_current: true }),
      }))
      setSessions((current) => current.map((item) => item.id === updated.id ? updated : { ...item, is_current: false, current_marker: null }))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <section className="academic-panel" aria-labelledby={`sessions-title-${school.id}`}>
      <div className="directory-heading">
        <h4 id={`sessions-title-${school.id}`}>School sessions</h4>
        <span>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {sessions.length ? (
        <ul className="team-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <div className="team-person"><strong>{session.title}</strong><span>{session.starts_on} to {session.ends_on}</span></div>
              {session.is_current ? <span className="role-pill">Current</span> : canManage ? <button className="quiet-button" type="button" onClick={() => makeCurrent(session)}>Make current</button> : null}
              <span className="role-pill">{session.status}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted-copy">No school sessions have been added.</p>}
      {canManage ? (
        <form className="add-member-form" onSubmit={createSession}>
          <h5>Add a session</h5>
          <label htmlFor={`session-title-${school.id}`}>Session title</label>
          <input id={`session-title-${school.id}`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength="100" required />
          <label htmlFor={`session-start-${school.id}`}>Start date</label>
          <input id={`session-start-${school.id}`} type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required />
          <label htmlFor={`session-end-${school.id}`}>End date</label>
          <input id={`session-end-${school.id}`} type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} min={startsOn || undefined} required />
          <button className="primary-button small-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add session'}</button>
        </form>
      ) : null}
    </section>
  )
}
