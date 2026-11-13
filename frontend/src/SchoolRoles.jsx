import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './api.js'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const validationMessage = Object.values(result.errors || {}).flat()[0]
    throw new Error(validationMessage || result.message || 'That request could not be completed.')
  }
  return result.data
}

function roleTitle(name) {
  return name.replaceAll('-', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function SchoolRoles({ school }) {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState({ name: '', permissions: [] })
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectedRole = roles.find((role) => role.id === selectedId)
  const groupedPermissions = useMemo(() => permissions.reduce((groups, permission) => {
    groups[permission.module] ||= []
    groups[permission.module].push(permission)
    return groups
  }, {}), [permissions])

  async function loadRoles() {
    setLoading(true)
    setError('')
    try {
      const data = await readData(await apiRequest(`/api/schools/${school.id}/roles`))
      setRoles(data.roles)
      setPermissions(data.permissions)
      setSelectedId((current) => current ?? data.roles.find((role) => role.name === 'admin')?.id ?? data.roles[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRoles() }, [school.id])

  useEffect(() => {
    if (creating) {
      setDraft({ name: '', permissions: [] })
      return
    }
    if (selectedRole) setDraft({ name: selectedRole.name, permissions: selectedRole.permissions })
  }, [selectedId, selectedRole?.id, creating])

  function togglePermission(permissionName) {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionName)
        ? current.permissions.filter((permission) => permission !== permissionName)
        : [...current.permissions, permissionName],
    }))
  }

  function toggleGroup(groupPermissions) {
    const names = groupPermissions.map((permission) => permission.name)
    const allSelected = names.every((name) => draft.permissions.includes(name))
    setDraft((current) => ({ ...current, permissions: allSelected ? current.permissions.filter((name) => !names.includes(name)) : [...new Set([...current.permissions, ...names])] }))
  }

  async function saveRole(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const endpoint = `/api/schools/${school.id}/roles${creating ? '' : `/${selectedId}`}`
      const saved = await readData(await apiRequest(endpoint, {
        method: creating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }))
      setRoles((current) => creating ? [...current, saved].sort((left, right) => left.name.localeCompare(right.name)) : current.map((role) => role.id === saved.id ? saved : role))
      setSelectedId(saved.id)
      setCreating(false)
      setNotice(`${roleTitle(saved.name)} role saved for ${school.name}.`)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteRole(role) {
    if (!window.confirm(`Delete the ${roleTitle(role.name)} role?`)) return
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/roles/${role.id}`, { method: 'DELETE' }))
      const remaining = roles.filter((item) => item.id !== role.id)
      setRoles(remaining)
      setSelectedId(remaining[0]?.id ?? null)
      setNotice(`${roleTitle(role.name)} role deleted.`)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return <section className="school-role-module">
    <div className="role-module-heading"><div><p className="eyebrow">SCHOOL ACCESS</p><h2>Roles & permissions</h2><p>Permissions are scoped to {school.name}. A role change in one school won’t affect another.</p></div><button className="primary-button small-button" type="button" onClick={() => { setCreating(true); setSelectedId(null); setError(''); setNotice('') }}>＋ Add role</button></div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="user-module-notice" role="status">{notice}</p> : null}
    {loading ? <p className="muted-copy" role="status">Loading school roles…</p> : <div className="role-module-layout">
      <aside className="role-list-card"><h3>School roles</h3><p>Choose a role to review its access.</p><div className="role-list-items">{roles.map((role) => <button key={role.id} type="button" className={(!creating && selectedId === role.id ? 'selected' : '')} onClick={() => { setCreating(false); setSelectedId(role.id); setError(''); setNotice('') }}><span><strong>{roleTitle(role.name)}</strong>{role.is_immutable ? <small>Global · locked</small> : <small>{role.assigned_users} assigned · {role.permissions.length} permissions</small>}</span><span aria-hidden="true">›</span></button>)}</div></aside>
      <form className="role-editor-card" onSubmit={saveRole}>
        <div className="role-editor-header"><div><p className="eyebrow">{creating ? 'NEW SCHOOL ROLE' : 'ROLE SETTINGS'}</p><h3>{creating ? 'Create a role' : selectedRole ? roleTitle(selectedRole.name) : 'Select a role'}</h3><p>{creating ? 'Create a school-specific role and choose the permissions it needs.' : selectedRole?.is_immutable ? 'Super Admin has every permission and cannot be edited or deleted.' : `Access rules for ${school.name}.`}</p></div>{selectedRole?.is_built_in && !selectedRole.is_immutable ? <span className="role-built-in-tag">Built-in role</span> : null}</div>
        {creating ? <label className="role-name-field">Role name<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value.toLowerCase().replaceAll(' ', '-') })} placeholder="for example librarian" pattern="[A-Za-z0-9_-]+" required /></label> : null}
        {selectedRole?.is_immutable ? <div className="immutable-role-note">All permissions are granted automatically to Super Admin, including permissions added in the future.</div> : null}
        {!creating && !selectedRole ? <p className="muted-copy">Choose a role from the list.</p> : null}
        {(creating || (selectedRole && !selectedRole.is_immutable)) ? <div className="role-permission-groups">{Object.entries(groupedPermissions).map(([module, groupPermissions]) => <section className="role-permission-group" key={module}><header><h4>{module}</h4><button type="button" className="quiet-button" onClick={() => toggleGroup(groupPermissions)}>{groupPermissions.every((permission) => draft.permissions.includes(permission.name)) ? 'Clear' : 'Select all'}</button></header><div>{groupPermissions.map((permission) => <label key={permission.name} className="role-permission-choice"><input type="checkbox" checked={draft.permissions.includes(permission.name)} onChange={() => togglePermission(permission.name)} /><span><strong>{permission.action}</strong><small>{permission.name}</small></span></label>)}</div></section>)}</div> : null}
        <div className="role-editor-actions">{creating || (selectedRole && !selectedRole.is_immutable) ? <button className="primary-button small-button" type="submit" disabled={busy}>{busy ? 'Saving…' : creating ? 'Create role' : 'Save permissions'}</button> : null}{selectedRole && !selectedRole.is_built_in ? <button className="quiet-button danger-action" type="button" onClick={() => deleteRole(selectedRole)}>Delete role</button> : null}</div>
      </form>
    </div>}
  </section>
}
