import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'
import AcademicStructure from './AcademicStructure.jsx'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.errors?.email?.[0] || result.errors?.slug?.[0] || result.message || 'That request could not be completed.')
  }
  return result.data
}

function SchoolCard({ school, user, onUpdated, onArchived }) {
  const canManageUsers = user.is_super_admin || school.role === 'school_admin'
  const [editing, setEditing] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [members, setMembers] = useState([])
  const [name, setName] = useState(school.name)
  const [slug, setSlug] = useState(school.slug)
  const [editStatus, setEditStatus] = useState(school.status)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(user.is_super_admin ? 'school_admin' : 'teacher')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function openTeam() {
    if (!teamOpen && members.length === 0) {
      setBusy(true)
      setError('')
      try {
        setMembers(await readData(await apiRequest(`/api/schools/${school.id}/users`)))
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setBusy(false)
      }
    }
    setTeamOpen(!teamOpen)
  }

  async function saveSchool(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await readData(await apiRequest(`/api/schools/${school.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, status: editStatus }),
      }))
      onUpdated(updated)
      setEditing(false)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function archiveSchool() {
    if (!window.confirm(`Archive ${school.name}? Its membership history will be kept.`)) return
    setBusy(true)
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}`, { method: 'DELETE' }))
      onArchived(school.id)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function addMember(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const added = await readData(await apiRequest(`/api/schools/${school.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }))
      setMembers((current) => [...current, added].sort((left, right) => left.name.localeCompare(right.name)))
      setEmail('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function updateMember(member, changes) {
    setError('')
    try {
      const updated = await readData(await apiRequest(`/api/schools/${school.id}/users/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      }))
      setMembers((current) => current.map((item) => item.id === member.id ? updated : item))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function removeMember(member) {
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/users/${member.id}`, { method: 'DELETE' }))
      setMembers((current) => current.filter((item) => item.id !== member.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <article className="school-card">
      <div className="school-card-heading">
        <span className="school-avatar" aria-hidden="true">{school.name.slice(0, 1)}</span>
        <div className="school-title-group">
          <h3>{school.name}</h3>
          <p>{school.slug} <span className="school-separator">·</span> {school.status}</p>
        </div>
        <span className="role-pill">{school.role.replace('_', ' ')}</span>
      </div>

      {user.is_super_admin && editing ? (
        <form className="school-edit-form" onSubmit={saveSchool}>
          <label htmlFor={`school-name-${school.id}`}>School name</label>
          <input id={`school-name-${school.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
          <label htmlFor={`school-slug-${school.id}`}>URL slug</label>
          <input id={`school-slug-${school.id}`} value={slug} onChange={(event) => setSlug(event.target.value)} required />
          <label htmlFor={`school-status-${school.id}`}>Status</label>
          <select id={`school-status-${school.id}`} value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="card-actions">
            <button className="primary-button small-button" type="submit" disabled={busy}>Save school</button>
            <button className="quiet-button" type="button" onClick={() => { setName(school.name); setSlug(school.slug); setEditStatus(school.status); setEditing(false) }}>Cancel</button>
          </div>
        </form>
      ) : null}

      {user.is_super_admin && !editing ? (
        <div className="card-actions">
          <button className="quiet-button" type="button" onClick={() => { setName(school.name); setSlug(school.slug); setEditStatus(school.status); setEditing(true) }}>Edit school</button>
          <button className="quiet-button danger-action" type="button" onClick={archiveSchool} disabled={busy}>Archive</button>
        </div>
      ) : null}

      {canManageUsers ? (
        <>
          <button className="team-toggle" type="button" aria-expanded={teamOpen} onClick={openTeam}>
            {teamOpen ? 'Hide school team' : 'Manage school team'}
          </button>
          {teamOpen ? (
            <div className="team-panel">
              <h4>School team</h4>
              {busy && members.length === 0 ? <p className="muted-copy">Loading team…</p> : null}
              {members.length ? (
                <ul className="team-list">
                  {members.map((member) => (
                    <li key={member.id}>
                      <div className="team-person">
                        <strong>{member.name}</strong><span>{member.email}</span>
                      </div>
                      {user.is_super_admin ? (
                        <select aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => updateMember(member, { role: event.target.value })}>
                          <option value="school_admin">School admin</option>
                          <option value="teacher">Teacher</option>
                        </select>
                      ) : <span className="role-pill">{member.role.replace('_', ' ')}</span>}
                      <label className="active-toggle">
                        <input type="checkbox" checked={member.is_active} onChange={(event) => updateMember(member, { is_active: event.target.checked })} />
                        Active
                      </label>
                      <button className="quiet-button danger-action" type="button" onClick={() => removeMember(member)}>Remove</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!busy && members.length === 0 ? <p className="muted-copy">No accounts are assigned to this school yet.</p> : null}
              <form className="add-member-form" onSubmit={addMember}>
                <label htmlFor={`member-email-${school.id}`}>Add an existing account by email</label>
                <div className="member-form-row">
                  <input id={`member-email-${school.id}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@school.edu" required />
                  {user.is_super_admin ? (
                    <select aria-label="New member role" value={role} onChange={(event) => setRole(event.target.value)}>
                      <option value="school_admin">School admin</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  ) : null}
                  <button className="primary-button small-button" type="submit" disabled={busy}>Add</button>
                </div>
              </form>
            </div>
          ) : null}
        </>
      ) : null}

      <AcademicStructure school={school} canManage={canManageUsers} />

      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </article>
  )
}

export default function SchoolWorkspace({ user, onLogout }) {
  const [schools, setSchools] = useState([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSchools() {
      try {
        const response = await apiRequest('/api/schools', { signal: controller.signal })
        setSchools(await readData(response))
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadSchools()
    return () => controller.abort()
  }, [])

  async function createSchool(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await readData(await apiRequest('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: slug || undefined }),
      }))
      setSchools((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)))
      setName('')
      setSlug('')
    } catch (createError) {
      setError(createError.message)
    } finally {
      setBusy(false)
    }
  }

  function updateSchool(updated) {
    setSchools((current) => current.map((school) => school.id === updated.id ? updated : school))
  }

  return (
    <section className="account-layout" aria-labelledby="account-title">
      <div className="account-heading">
        <div>
          <p className="eyebrow">{user.is_super_admin ? 'Platform administration' : 'School workspace'}</p>
          <h1 id="account-title">Welcome, {user.name}.</h1>
          <p className="intro">{user.email}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onLogout}>Sign out</button>
      </div>

      {user.is_super_admin ? (
        <form className="create-school-card" onSubmit={createSchool}>
          <div>
            <p className="eyebrow">School directory</p>
            <h2>Add a school</h2>
          </div>
          <div className="create-school-fields">
            <label htmlFor="new-school-name">School name</label>
            <input id="new-school-name" value={name} onChange={(event) => setName(event.target.value)} required />
            <label htmlFor="new-school-slug">URL slug <span>(optional)</span></label>
            <input id="new-school-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="created from school name" />
          </div>
          <button className="primary-button small-button" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add school'}</button>
        </form>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="school-directory">
        <div className="directory-heading">
          <h2>{user.is_super_admin ? 'Schools' : 'Your schools'}</h2>
          <span>{schools.length} {schools.length === 1 ? 'school' : 'schools'}</span>
        </div>
        {loading ? <p className="muted-copy" role="status">Loading schools…</p> : null}
        {!loading && schools.length === 0 ? (
          <p className="empty-memberships">
            {user.is_super_admin ? 'No schools yet. Add the first one above.' : 'No active school is assigned yet. Ask your school administrator for access.'}
          </p>
        ) : null}
        <div className="school-card-list">
          {schools.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              user={user}
              onUpdated={updateSchool}
              onArchived={(id) => setSchools((current) => current.filter((item) => item.id !== id))}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
