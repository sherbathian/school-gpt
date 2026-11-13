import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './api.js'
import DataTools from './DataTools.jsx'
import TableAction from './TableAction.jsx'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = Object.values(result.errors || {}).flat()[0]
    throw new Error(message || result.message || 'That request could not be completed.')
  }
  return result.data
}

const initialForm = { name: '', email: '', password: '', is_active: true }
const importFields = [
  { key: 'name', label: 'name', required: true },
  { key: 'email', label: 'email', required: true },
  { key: 'password', label: 'password', required: true },
]
const exportFields = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'global_role', label: 'Account type' },
  { key: 'is_active', label: 'Status' },
  { key: 'schools', label: 'School access' },
]

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      setUsers(await readData(await apiRequest('/api/users')))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const result = users.filter((user) => `${user.name} ${user.email} ${user.global_role} ${user.schools.map((school) => school.name).join(' ')}`.toLowerCase().includes(query))
    return result.sort((left, right) => {
      const value = (user) => sort.key === 'schools' ? user.schools.map((school) => school.name).join(', ') : sort.key === 'is_active' ? (user.is_active ? 'active' : 'inactive') : user[sort.key]
      const comparison = String(value(left) ?? '').localeCompare(String(value(right) ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [users, search, sort])
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize)
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => number === 1 || number === pageCount || Math.abs(number - safePage) <= 1).reduce((result, number, index, list) => {
    if (index && number - list[index - 1] > 1) result.push(`ellipsis-${number}`)
    result.push(number)
    return result
  }, [])

  function sortBy(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  }

  function startEdit(user) {
    setForm({ name: user.name, email: user.email, password: '', is_active: user.is_active })
    setEditingId(user.id)
    setShowForm(true)
    setError('')
    setNotice('')
  }

  async function saveUser(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = { ...form }
      if (editingId && !payload.password) delete payload.password
      const saved = await readData(await apiRequest(editingId ? `/api/users/${editingId}` : '/api/users', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }))
      setUsers((current) => editingId ? current.map((user) => user.id === saved.id ? saved : user) : [...current, saved])
      setForm(initialForm)
      setEditingId(null)
      setShowForm(false)
      setNotice(editingId ? 'User account updated.' : 'User account created.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function importUser(row) {
    const created = await readData(await apiRequest('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: row.name, email: row.email, password: row.password, is_active: true }),
    }))
    setUsers((current) => [...current, created])
  }

  async function toggleActive(user) {
    setError('')
    try {
      const updated = await readData(await apiRequest(`/api/users/${user.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      }))
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Permanently delete ${user.name}'s account?`)) return
    setError('')
    try {
      await readData(await apiRequest(`/api/users/${user.id}`, { method: 'DELETE' }))
      setUsers((current) => current.filter((item) => item.id !== user.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const sortButton = (key, label) => <button className="student-sort-button" type="button" onClick={() => sortBy(key)}>{label}<span>{sort.key === key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button>

  return <section className="user-management">
    <div className="user-module-toolbar">
      <div><p className="eyebrow">ACCESS CONTROL</p><h2>Accounts and platform roles</h2><p>Manage sign-in accounts here. School Admin and Teacher access is assigned per school.</p></div>
      <button className="primary-button small-button" type="button" onClick={() => { setForm(initialForm); setEditingId(null); setShowForm((current) => !current); setError('') }}>{showForm ? 'Close form' : '＋ Add user'}</button>
    </div>

    {showForm ? <form className="user-form-card" onSubmit={saveUser}>
      <div className="user-form-heading"><div><p className="eyebrow">USER ACCOUNT</p><h3>{editingId ? 'Edit user' : 'Create user'}</h3></div><span>Passwords must be at least 12 characters.</span></div>
      <div className="user-form-grid">
        <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label>{editingId ? 'New password (optional)' : 'Password'}<input type="password" minLength="12" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingId} autoComplete="new-password" /></label>
      </div>
      <p className="muted-copy user-account-role-note">School roles and permissions are assigned from the relevant school’s team settings. Super Admin accounts are managed separately.</p>
      <label className="user-active-option"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Account can sign in</label>
      <div className="card-actions"><button className="primary-button small-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create user'}</button><button className="quiet-button" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(initialForm) }}>Cancel</button></div>
    </form> : null}

    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {notice ? <p className="user-module-notice" role="status">{notice}</p> : null}
    <div className="user-list-card">
      <div className="user-list-heading"><div><h3>All users</h3><span>{users.length} {users.length === 1 ? 'account' : 'accounts'}</span></div><label className="module-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name, email, role or school" aria-label="Search users" /></label></div>
      <DataTools title="Users" rows={users.map((user) => ({ ...user, is_active: user.is_active ? 'Active' : 'Inactive', schools: user.schools.map((school) => `${school.name} (${school.role.replaceAll('_', ' ')})`).join('; ') || 'No school assigned' }))} fields={importFields} exportFields={exportFields} canImport onImport={importUser} />
      <div className="crud-table-wrap"><table className="crud-table user-table"><thead><tr><th>{sortButton('name', 'User')}</th><th>{sortButton('global_role', 'Account type')}</th><th>{sortButton('schools', 'School access')}</th><th>{sortButton('is_active', 'Status')}</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="5" className="expense-empty-cell">Loading user accounts…</td></tr> : visibleUsers.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><span className={`user-role-pill ${user.is_super_admin ? 'user-role-admin' : ''}`}>{user.is_super_admin ? 'Super Admin' : 'User account'}</span></td><td>{user.schools.length ? user.schools.map((school) => <span key={school.id} className="user-school-access">{school.name}<small>{school.role.replaceAll('_', ' ')}{school.is_active ? '' : ' · inactive'}</small></span>) : <span className="muted-copy">No school assigned</span>}</td><td><span className={`inquiry-status ${user.is_active ? 'inquiry-status-registered' : 'inquiry-status-withdrawn'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="expense-row-actions"><TableAction action="edit" label={`Edit ${user.name}`} onClick={() => startEdit(user)} />{!user.is_super_admin ? <><button className="quiet-button" type="button" onClick={() => toggleActive(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button><TableAction action="delete" label={`Delete ${user.name}`} danger onClick={() => deleteUser(user)} /></> : <span className="muted-copy">Protected</span>}</div></td></tr>)}
        {!loading && !visibleUsers.length ? <tr><td colSpan="5" className="expense-empty-cell">No users match your search.</td></tr> : null}
      </tbody></table></div>
      <footer className="expense-table-footer"><span>Showing {filteredUsers.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filteredUsers.length)} of {filteredUsers.length} users</span><label>Rows <select aria-label="Users per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><nav aria-label="User table pagination"><button type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>{pages.map((number) => typeof number === 'string' ? <span key={number} className="inquiry-page-ellipsis">…</span> : <button type="button" key={number} className={safePage === number ? 'active' : ''} aria-current={safePage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}<button type="button" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>›</button></nav></footer>
    </div>
  </section>
}
