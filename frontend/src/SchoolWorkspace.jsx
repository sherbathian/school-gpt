import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'
import AcademicStructure from './AcademicStructure.jsx'
import StudentRoster from './StudentRoster.jsx'
import FeeManagement from './FeeManagement.jsx'
import FeeSetup from './FeeSetup.jsx'
import SchoolSessions from './SchoolSessions.jsx'
import StaffManagement from './StaffManagement.jsx'
import GuardianManagement from './GuardianManagement.jsx'
import DataTools from './DataTools.jsx'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const validationMessage = Object.values(result.errors || {}).flat()[0]
    throw new Error(validationMessage || result.message || 'That request could not be completed.')
  }
  return result.data
}

function SchoolCard({ school, user, onUpdated, onArchived, onActiveSessionChange, onNavigate, activeStudentId, onOpenStudent, onCloseStudent, activeModule = 'schools' }) {
  const canManageUsers = user.is_super_admin || school.role === 'school_admin'
  const canTakeAttendance = user.is_super_admin || ['school_admin', 'teacher'].includes(school.role)
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

  async function importMember(row) {
    const added = await readData(await apiRequest(`/api/schools/${school.id}/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: row.email, role: 'teacher' }),
    }))
    setMembers((current) => [...current, added].sort((left, right) => left.name.localeCompare(right.name)))
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
    <article className="school-card" id={`school-${school.id}`}>
      <div className="school-card-heading">
        <span className="school-avatar" aria-hidden="true">{school.name.slice(0, 1)}</span>
        <div className="school-title-group">
          <h3>{school.name}</h3>
          <p>{school.slug} <span className="school-separator">·</span> {school.status}</p>
        </div>
        <span className="role-pill">{school.role.replace('_', ' ')}</span>
      </div>

      {activeModule === 'schools' && user.is_super_admin && editing ? (
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

      {activeModule === 'schools' && user.is_super_admin && !editing ? (
        <div className="card-actions">
          <button className="quiet-button" type="button" onClick={() => { setName(school.name); setSlug(school.slug); setEditStatus(school.status); setEditing(true) }}>Edit school</button>
          <button className="quiet-button danger-action" type="button" onClick={archiveSchool} disabled={busy}>Archive</button>
        </div>
      ) : null}

      {activeModule === 'schools' && canManageUsers ? (
        <>
          <button className="team-toggle" type="button" aria-expanded={teamOpen} onClick={openTeam}>
            {teamOpen ? 'Hide school team' : 'Manage school team'}
          </button>
          {teamOpen ? (
            <div className="team-panel">
              <h4>School team</h4>
              <DataTools title="School team" rows={members} fields={[{ key: 'name', label: 'name' }, { key: 'email', label: 'email', required: true }]} canImport={canManageUsers} onImport={importMember} />
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

      {activeModule.startsWith('academic-') && activeModule !== 'academic-years' ? <AcademicStructure school={school} canManage={canManageUsers} expanded standalone activeSection={activeModule.replace('academic-', '')} /> : null}
      {activeModule === 'academic-years' ? <SchoolSessions school={school} canManage={canManageUsers} onCurrentChange={onActiveSessionChange} /> : null}
      {activeModule.startsWith('staff-') ? <StaffManagement school={school} canManage={canManageUsers} activeView={activeModule} onNavigate={onNavigate} /> : null}
      {activeModule === 'students' ? <StudentRoster school={school} canManage={canManageUsers} canTakeAttendance={canTakeAttendance} expanded standalone selectedStudentId={activeStudentId} onOpenStudent={onOpenStudent} onCloseStudent={onCloseStudent} onNavigate={onNavigate} /> : null}
      {activeModule === 'guardians' ? <GuardianManagement school={school} canManage={canManageUsers} onNavigate={onNavigate} onOpenStudent={onOpenStudent} /> : null}
      {activeModule === 'attendance' ? <StudentRoster school={school} canManage={canManageUsers} canTakeAttendance={canTakeAttendance} expanded attendanceOnly standalone /> : null}
      {['fees-catalog', 'fees-discounts', 'fees-groups', 'fees-masters'].includes(activeModule) && canManageUsers ? <FeeSetup school={school} activeSection={activeModule.replace('fees-', '') === 'catalog' ? 'fee-types' : activeModule.replace('fees-', '')} /> : null}
      {['fee-items', 'invoices'].includes(activeModule) && canManageUsers ? <FeeManagement school={school} expanded standalone activeView={activeModule} /> : null}

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
  const [activeModule, setActiveModule] = useState('overview')
  const [activeStudentId, setActiveStudentId] = useState(null)
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [sidebarSessions, setSidebarSessions] = useState([])
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionError, setSessionError] = useState('')

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

  const activeSchoolId = schools.some((school) => String(school.id) === selectedSchoolId)
    ? selectedSchoolId
    : String(schools[0]?.id || '')

  useEffect(() => {
    if (!activeSchoolId) {
      setSidebarSessions([])
      return undefined
    }
    const controller = new AbortController()
    setSessionError('')
    apiRequest(`/api/schools/${activeSchoolId}/sessions`, { signal: controller.signal })
      .then(readData)
      .then(setSidebarSessions)
      .catch((requestError) => {
        if (!controller.signal.aborted) setSessionError(requestError.message)
      })
    return () => controller.abort()
  }, [activeSchoolId])

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
      setSelectedSchoolId(String(created.id))
      setActiveModule('academic-sections')
      setName('')
      setSlug('')
    } catch (createError) {
      setError(createError.message)
    } finally {
      setBusy(false)
    }
  }

  async function importSchool(row) {
    const created = await readData(await apiRequest('/api/schools', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: row.name, slug: row.slug || undefined }),
    }))
    setSchools((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)))
  }

  function updateSchool(updated) {
    setSchools((current) => current.map((school) => school.id === updated.id ? updated : school))
  }

  function updateActiveSession(schoolId, session) {
    setSchools((current) => current.map((school) => String(school.id) === String(schoolId) ? {
      ...school,
      active_session: { id: session.id, title: session.title, academic_year: `${session.starts_on.slice(0, 4)}-${session.ends_on.slice(0, 4)}`, starts_on: session.starts_on, ends_on: session.ends_on },
    } : school))
  }

  function applyCurrentSession(schoolId, session) {
    setSidebarSessions((current) => [
      session,
      ...current.filter((item) => item.id !== session.id).map((item) => ({ ...item, is_current: false, current_marker: null })),
    ])
    updateActiveSession(schoolId, session)
  }

  async function changeActiveSession(event) {
    const sessionId = event.target.value
    if (!sessionId || !activeSchoolId || !canManageSchool) return
    setSessionBusy(true)
    setSessionError('')
    try {
      const updated = await readData(await apiRequest(`/api/schools/${activeSchoolId}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_current: true }),
      }))
      applyCurrentSession(activeSchoolId, updated)
    } catch (requestError) {
      setSessionError(requestError.message)
    } finally {
      setSessionBusy(false)
    }
  }

  const activeSchool = schools.find((school) => String(school.id) === activeSchoolId)
  const canManageSchool = user.is_super_admin || activeSchool?.role === 'school_admin'
  const navGroups = [
    { title: 'GENERAL', items: [['overview', '▦', 'Overview'], ['schools', '⌂', 'Schools']] },
    { title: 'STUDENTS', items: [['students', '♧', 'Students'], ['attendance', '✓', 'Attendance']] },
    { title: 'GUARDIANS', items: [['guardians', '♙', 'Guardians']] },
    { title: 'ACADEMICS', items: [['academic-sections', '▤', 'Sections'], ['academic-grades', '▤', 'Grades'], ['academic-subjects', '◈', 'Subjects'], ['academic-years', '◷', 'Academic years']] },
    { title: 'FINANCE', items: [['fees-catalog', '＄', 'Fee catalog'], ['fees-discounts', '%', 'Discounts'], ['fees-groups', '▣', 'Fee groups'], ['fees-masters', '▤', 'Fee masters'], ['fee-items', '＋', 'Invoice fee items'], ['invoices', '▧', 'Invoices & payments']] },
    { title: 'PEOPLE', items: [['staff-directory', '♙', 'Staff'], ['staff-create', '＋', 'Add staff'], ['staff-designations', '◇', 'Designations'], ['staff-departments', '▥', 'Departments'], ['staff-leave-types', '◷', 'Leave types']] },
  ].map((group) => ({
    ...group,
    items: group.items.filter(([key]) => {
      if (key.startsWith('fees-') || key === 'fee-items' || key === 'invoices') return canManageSchool
      if (['staff-create', 'staff-designations', 'staff-departments', 'staff-leave-types'].includes(key)) return canManageSchool
      return true
    }),
  })).filter((group) => group.items.length)
  const moduleLabels = Object.fromEntries(navGroups.flatMap(({ items }) => items.map(([key, , label]) => [key, label])))
  const activeModuleLabel = moduleLabels[activeModule] || 'Overview'

  return (
    <section className="account-layout dashboard-layout" aria-labelledby="account-title">
      <aside className="dashboard-sidebar" aria-label="School management navigation">
        <a className="dashboard-brand" href="#account-title"><span className="dashboard-brand-mark">S</span><span>Schoolhouse<small>ADMIN CONSOLE</small></span></a>
        {activeSchool ? <div className="sidebar-session-switcher">
          <span className="sidebar-session-caption">Current session</span>
          {canManageSchool ? <select aria-label="Current session" value={activeSchool.active_session?.id || ''} onChange={changeActiveSession} disabled={sessionBusy || sidebarSessions.length === 0}>
            {!activeSchool.active_session ? <option value="">No active session</option> : null}
            {sidebarSessions.filter((session) => session.status === 'active').map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
          </select> : <strong>{activeSchool.active_session?.title || 'No active session'}</strong>}
          {activeSchool.active_session?.academic_year ? <small>{activeSchool.active_session.academic_year}</small> : null}
          {sessionError ? <small className="sidebar-session-error" role="alert">{sessionError}</small> : null}
        </div> : null}
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="dashboard-nav" aria-label="Workspace pages">
          {navGroups.map((group) => <div className="dashboard-nav-group" key={group.title}>
            <p className="sidebar-label">{group.title}</p>
            {group.items.map(([key, icon, label]) => (
              <button key={key} className={activeModule === key ? 'active' : ''} type="button" aria-current={activeModule === key ? 'page' : undefined} onClick={() => { setActiveStudentId(null); setActiveModule(key) }}>
                <span>{icon}</span>{label}{key === 'schools' ? <b>{schools.length}</b> : null}
              </button>
            ))}
          </div>)}
        </nav>
        <div className="sidebar-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.is_super_admin ? 'Platform admin' : 'School account'}</small></span></div>
      </aside>
      <div className="dashboard-main">
      <div className="dashboard-topbar">
        <div className="breadcrumb">Workspace <span>/</span> <strong>{activeModuleLabel}</strong></div>
        <div className="topbar-controls">
          {activeModule !== 'overview' && activeModule !== 'schools' && schools.length ? <label className="school-picker">School<select aria-label="Selected school" value={activeSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label> : null}
          <div className="topbar-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><button className="secondary-button" type="button" onClick={onLogout}>Sign out</button></div>
        </div>
      </div>
      <div className="account-heading">
        <div>
          <p className="eyebrow">{activeModule === 'overview' ? (user.is_super_admin ? 'PLATFORM OVERVIEW' : 'SCHOOL OVERVIEW') : 'SCHOOL MANAGEMENT'}</p>
          <h1 id="account-title">{activeModule === 'overview' ? `Good to see you, ${user.name.split(' ')[0]}.` : activeModuleLabel}</h1>
          <p className="intro">{activeModule === 'overview' ? 'Here’s what’s happening across your school workspace.' : `Manage ${activeModuleLabel.toLowerCase()} for ${activeSchool?.name || 'your school'}.`}</p>
        </div>
      </div>

      {activeModule === 'overview' ? <div className="overview-stats" aria-label="Workspace summary">
        <article className="overview-stat"><span className="stat-icon stat-indigo">▤</span><div><span>Total schools</span><strong>{loading ? '—' : schools.length}</strong><small>In your workspace</small></div><span className="stat-sparkline">⌁</span></article>
        <article className="overview-stat"><span className="stat-icon stat-green">✓</span><div><span>Active schools</span><strong>{loading ? '—' : schools.filter((school) => school.status === 'active').length}</strong><small>Ready to manage</small></div><span className="stat-sparkline green">⌁</span></article>
        <article className="overview-stat"><span className="stat-icon stat-orange">♙</span><div><span>Your access</span><strong className="stat-role">{user.is_super_admin ? 'Platform admin' : 'School team'}</strong><small>{user.is_super_admin ? 'All schools' : 'Assigned schools'}</small></div><span className="stat-sparkline orange">⌁</span></article>
      </div> : null}

      {activeModule === 'schools' && user.is_super_admin ? (
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
      {activeModule === 'overview' || activeModule === 'schools' ? <div className="school-directory" id="school-directory">
        <div className="directory-heading">
          <h2>{user.is_super_admin ? 'Schools' : 'Your schools'}</h2>
          <span>{schools.length} {schools.length === 1 ? 'school' : 'schools'}</span>
        </div>
        <DataTools title="Schools" rows={schools} fields={[{ key: 'name', label: 'name', required: true }, { key: 'slug', label: 'slug' }, { key: 'status', label: 'status' }]} canImport={user.is_super_admin && activeModule === 'schools'} onImport={importSchool} />
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
              activeModule={activeModule}
              onNavigate={(module) => { setActiveStudentId(null); setActiveModule(module) }}
              onUpdated={updateSchool}
              onArchived={(id) => setSchools((current) => current.filter((item) => item.id !== id))}
            />
          ))}
        </div>
      </div> : null}
      {activeModule !== 'overview' && activeModule !== 'schools' ? (
        schools.find((school) => String(school.id) === activeSchoolId)
          ? <div className="active-module-page"><SchoolCard key={`${activeSchoolId}-${activeModule}-${activeSchool?.active_session?.id || 'no-session'}`} school={schools.find((school) => String(school.id) === activeSchoolId)} user={user} onUpdated={updateSchool} onActiveSessionChange={(session) => applyCurrentSession(activeSchoolId, session)} onArchived={(id) => { setSchools((current) => current.filter((item) => item.id !== id)); setActiveModule('schools') }} onNavigate={(module) => { setActiveStudentId(null); setActiveModule(module) }} activeModule={activeModule} activeStudentId={activeStudentId} onOpenStudent={(student) => setActiveStudentId(student.id)} onCloseStudent={() => setActiveStudentId(null)} /></div>
          : <p className="empty-memberships">{loading ? 'Loading schools…' : 'Add or select a school to open this module.'}</p>
      ) : null}
      </div>
    </section>
  )
}
