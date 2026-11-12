import { Fragment, useEffect, useState } from 'react'
import { apiRequest } from './api.js'
import DataTools from './DataTools.jsx'
import TableAction from './TableAction.jsx'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || Object.values(result.errors || {}).flat()[0] || 'That request could not be completed.')
  return result.data
}

export default function SchoolSessions({ school, canManage, onCurrentChange }) {
  const [sessions, setSessions] = useState([])
  const [title, setTitle] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', starts_on: '', ends_on: '' })
  const [search, setSearch] = useState('')
  const visibleSessions = sessions.filter((session) => `${session.title} ${session.starts_on} ${session.ends_on} ${session.status}`.toLowerCase().includes(search.toLowerCase()))

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
      if (session.is_current) onCurrentChange?.(session)
      setTitle('')
      setStartsOn('')
      setEndsOn('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function importSession(row) {
    const session = await readData(await apiRequest(`/api/schools/${school.id}/sessions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: row.title, starts_on: row.starts_on, ends_on: row.ends_on }),
    }))
    setSessions((current) => [...current, session].sort((left, right) => right.starts_on.localeCompare(left.starts_on)))
  }

  async function makeCurrent(session) {
    setError('')
    try {
      const updated = await readData(await apiRequest(`/api/schools/${school.id}/sessions/${session.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_current: true }),
      }))
      setSessions((current) => current.map((item) => item.id === updated.id ? updated : { ...item, is_current: false, current_marker: null }))
      onCurrentChange?.(updated)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function startEditing(session) {
    setEditingId(session.id)
    setEditForm({ title: session.title, starts_on: session.starts_on, ends_on: session.ends_on })
  }

  async function saveSession(event, session) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await readData(await apiRequest(`/api/schools/${school.id}/sessions/${session.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
      }))
      setSessions((current) => current.map((item) => item.id === updated.id ? updated : item).sort((left, right) => right.starts_on.localeCompare(left.starts_on)))
      if (updated.is_current) onCurrentChange?.(updated)
      setEditingId(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="academic-panel" aria-labelledby={`sessions-title-${school.id}`}>
      <div className="directory-heading">
        <h4 id={`sessions-title-${school.id}`}>School sessions</h4>
        <span>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <DataTools title="School sessions" rows={sessions} fields={[{ key: 'title', label: 'title', required: true }, { key: 'starts_on', label: 'starts_on', required: true }, { key: 'ends_on', label: 'ends_on', required: true }, { key: 'status', label: 'status' }, { key: 'is_current', label: 'is_current' }]} canImport={canManage} onImport={importSession} />
      <label className="module-search table-search"><span aria-hidden="true">⌕</span><input aria-label="Search academic years" placeholder="Search academic years" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {sessions.length ? (
        <div className="crud-table-wrap"><table className="crud-table"><thead><tr><th>Session</th><th>Date range</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {visibleSessions.map((session) => (
            <Fragment key={session.id}>
              <tr>
                <td>{session.title}{session.is_current ? <small>Active academic year</small> : null}</td>
                <td>{session.starts_on} – {session.ends_on}</td>
                <td>{session.status}</td>
                <td>{!session.is_current && canManage ? <TableAction action="current" label="Make current session" onClick={() => makeCurrent(session)} /> : null}{canManage ? <TableAction action="edit" label="Edit session" onClick={() => startEditing(session)} /> : null}</td>
              </tr>
              {editingId === session.id ? <tr><td colSpan="4"><form className="session-edit-form" onSubmit={(event) => saveSession(event, session)}>
                <label>Session title<input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} maxLength="100" required /></label>
                <label>Start date<input type="date" value={editForm.starts_on} onChange={(event) => setEditForm((current) => ({ ...current, starts_on: event.target.value }))} required /></label>
                <label>End date<input type="date" value={editForm.ends_on} min={editForm.starts_on || undefined} onChange={(event) => setEditForm((current) => ({ ...current, ends_on: event.target.value }))} required /></label>
                <button className="primary-button small-button" type="submit" disabled={busy}>Save session</button>
                <button className="quiet-button" type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </form></td></tr> : null}
            </Fragment>
          ))}
        </tbody></table></div>
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
