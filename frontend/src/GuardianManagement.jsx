import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './api.js'
import DataTools from './DataTools.jsx'
import TableAction from './TableAction.jsx'

const textFields = [
  ['father_name', 'Father name', 'text'], ['father_phone', 'Father phone', 'tel'], ['father_occupation', 'Father occupation', 'text'], ['father_cnic', 'Father CNIC', 'text'],
  ['mother_name', 'Mother name', 'text'], ['mother_phone', 'Mother phone', 'tel'], ['mother_occupation', 'Mother occupation', 'text'], ['mother_cnic', 'Mother CNIC', 'text'],
  ['guardian_name', 'Guardian name', 'text'], ['guardian_relation', 'Guardian relation', 'text'], ['guardian_email', 'Guardian email', 'email'], ['guardian_phone', 'Guardian phone', 'tel'], ['guardian_occupation', 'Guardian occupation', 'text'], ['guardian_cnic', 'Guardian CNIC', 'text'], ['guardian_address', 'Guardian address', 'textarea'],
]
const guardianKeys = textFields.map(([key]) => key)
const importFields = textFields.map(([key]) => ({ key, label: key, required: ['father_name', 'father_cnic', 'mother_name', 'mother_cnic'].includes(key) }))
const exportFields = ['id', ...guardianKeys, 'is_guardian_other', 'students_count'].map((key) => ({ key, label: key }))

function emptyGuardian() {
  return Object.fromEntries([...guardianKeys, 'is_guardian_other'].map((key) => [key, key === 'is_guardian_other' ? false : '']))
}

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'That request could not be completed.')
  return result.data
}

export default function GuardianManagement({ school, canManage }) {
  const [guardians, setGuardians] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [parentId, setParentId] = useState('')
  const [form, setForm] = useState(emptyGuardian)
  const [files, setFiles] = useState({})
  const [removeFiles, setRemoveFiles] = useState({})
  const [mediaUrls, setMediaUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setGuardians(await readData(await apiRequest(`/api/schools/${school.id}/guardians`)))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiRequest(`/api/schools/${school.id}/guardians`)
      .then(readData)
      .then((data) => { if (!cancelled) setGuardians(data) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [school.id])

  const visibleGuardians = useMemo(() => guardians.filter((guardian) => Object.values(guardian).join(' ').toLowerCase().includes(search.trim().toLowerCase())), [guardians, search])

  function startCreate() {
    setEditingId(null)
    setParentId('')
    setForm(emptyGuardian())
    setFiles({})
    setRemoveFiles({})
    setMediaUrls({})
    setShowForm(true)
    setError('')
  }

  async function startEdit(guardian) {
    setBusy(true)
    setError('')
    try {
      const detail = await readData(await apiRequest(`/api/schools/${school.id}/guardians/${guardian.id}`))
      setEditingId(guardian.id)
      setParentId(String(detail.id))
      setForm(Object.fromEntries([...guardianKeys, 'is_guardian_other'].map((key) => [key, detail[key] ?? (key === 'is_guardian_other' ? false : '')])))
      setMediaUrls(Object.fromEntries(['father', 'mother', 'guardian'].map((kind) => [kind, detail[`${kind}_doc_url`] || ''])))
      setFiles({})
      setRemoveFiles({})
      setShowForm(true)
    } catch (loadError) { setError(loadError.message) } finally { setBusy(false) }
  }

  async function saveGuardian(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([key, value]) => payload.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : value ?? ''))
      Object.entries(files).forEach(([key, file]) => { if (file) payload.append(`${key}_doc`, file) })
      Object.entries(removeFiles).forEach(([key, value]) => payload.append(`remove_${key}_doc`, value ? '1' : '0'))
      if (editingId) payload.append('_method', 'PATCH')
      const updated = await readData(await apiRequest(`/api/schools/${school.id}/guardians${editingId ? `/${editingId}` : ''}`, { method: 'POST', body: payload }))
      setGuardians((current) => editingId ? current.map((item) => item.id === editingId ? updated : item) : [...current, updated].sort((left, right) => left.father_name.localeCompare(right.father_name)))
      setShowForm(false)
    } catch (saveError) { setError(saveError.message) } finally { setBusy(false) }
  }

  async function importGuardian(row) {
    const payload = Object.fromEntries([...guardianKeys, 'is_guardian_other'].filter((key) => row[key] !== undefined).map((key) => [key, key === 'is_guardian_other' ? ['1', 'true', 'yes'].includes(String(row[key]).toLowerCase()) : row[key]]))
    const created = await readData(await apiRequest(`/api/schools/${school.id}/guardians`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
    setGuardians((current) => [...current, created].sort((left, right) => left.father_name.localeCompare(right.father_name)))
  }

  async function deleteGuardian(guardian) {
    if (!window.confirm(`Delete guardian ${guardian.father_name}?`)) return
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/guardians/${guardian.id}`, { method: 'DELETE' }))
      setGuardians((current) => current.filter((item) => item.id !== guardian.id))
    } catch (deleteError) { setError(deleteError.message) }
  }

  function documentControl(kind, title) {
    const hasExisting = Boolean(mediaUrls[kind] || (editingId && guardians.find((guardian) => guardian.id === editingId)?.[`${kind}_doc_path`]))
    return <label className="guardian-file-field">{title}<span className="guardian-file-drop">{files[kind] ? files[kind].name : 'Drag and drop a file or browse'}<input type="file" accept=".pdf,image/png,image/jpeg" onChange={(event) => setFiles((current) => ({ ...current, [kind]: event.target.files?.[0] || null }))} /></span>{mediaUrls[kind] ? <a href={mediaUrls[kind]} target="_blank" rel="noreferrer">View current document</a> : null}{hasExisting && editingId ? <span className="student-file-remove"><input type="checkbox" checked={Boolean(removeFiles[kind])} onChange={(event) => setRemoveFiles((current) => ({ ...current, [kind]: event.target.checked }))} /> Remove current document</span> : <small>PDF or image · max 5 MB</small>}</label>
  }

  return <section className="academic-panel guardian-module" aria-labelledby={`guardians-heading-${school.id}`}>
    {!showForm ? <>
      <div className="directory-heading"><div><h4 id={`guardians-heading-${school.id}`}>Guardians</h4><p>Manage parent and guardian details for {school.name}.</p></div><span>{guardians.length} {guardians.length === 1 ? 'guardian' : 'guardians'}</span></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {canManage ? <DataTools title="Guardians" rows={guardians} fields={importFields} exportFields={exportFields} canImport onImport={importGuardian} /> : null}
      <div className="guardian-list-toolbar"><label className="module-search table-search"><span aria-hidden="true">⌕</span><input aria-label="Search guardians" placeholder="Search by parent ID, parent name, phone or CNIC" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{canManage ? <button className="primary-button small-button" type="button" onClick={startCreate}>＋ New guardian</button> : null}</div>
      {loading ? <p className="muted-copy" role="status">Loading guardians…</p> : null}
      {!loading && visibleGuardians.length ? <div className="crud-table-wrap"><table className="crud-table guardian-table"><thead><tr><th>Parent ID</th><th>Father name</th><th>Father phone</th><th>Father occupation</th><th>Father CNIC</th><th>Mother name</th><th>Students</th><th>Actions</th></tr></thead><tbody>{visibleGuardians.map((guardian) => <tr key={guardian.id}><td>{guardian.id}</td><td>{guardian.father_name}</td><td>{guardian.father_phone || '—'}</td><td>{guardian.father_occupation || '—'}</td><td>{guardian.father_cnic}</td><td>{guardian.mother_name}</td><td>{guardian.students_count || 0}</td><td>{canManage ? <><TableAction action="edit" label="Edit guardian" onClick={() => startEdit(guardian)} disabled={busy} /><TableAction action="delete" label="Delete guardian" danger onClick={() => deleteGuardian(guardian)} /></> : '—'}</td></tr>)}</tbody></table></div> : null}
      {!loading && visibleGuardians.length === 0 ? <p className="muted-copy">No guardians match this search. Add a guardian or import a CSV file to get started.</p> : null}
    </> : <form className="guardian-profile-form" onSubmit={saveGuardian}>
      <div className="student-form-heading"><div><p className="eyebrow">Guardians</p><h4>{editingId ? 'Edit guardian' : 'Create guardian'}</h4><p>Enter parent details and attach supporting documents.</p></div><button className="quiet-button" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {editingId ? <div className="guardian-parent-id"><span>Parent ID</span><strong>{parentId}</strong><small>Generated automatically</small></div> : null}
      <fieldset className="guardian-form-section"><legend>Father details</legend><div className="guardian-form-grid">{textFields.slice(0, 4).map(([key, label, type]) => <label key={key}>{label}{type === 'textarea' ? <textarea value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /> : <input type={type} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required={['father_name', 'father_cnic'].includes(key)} />}</label>)}{documentControl('father', 'Father document')}</div></fieldset>
      <fieldset className="guardian-form-section"><legend>Mother details</legend><div className="guardian-form-grid">{textFields.slice(4, 8).map(([key, label, type]) => <label key={key}>{label}<input type={type} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required={['mother_name', 'mother_cnic'].includes(key)} /></label>)}{documentControl('mother', 'Mother document')}</div></fieldset>
      <fieldset className="guardian-form-section"><legend>Other guardian</legend><label className="student-form-check guardian-toggle"><input type="checkbox" checked={form.is_guardian_other} onChange={(event) => setForm((current) => ({ ...current, is_guardian_other: event.target.checked }))} /> Use another guardian</label>{form.is_guardian_other ? <div className="guardian-form-grid">{textFields.slice(8).map(([key, label, type]) => <label key={key}>{label}{type === 'textarea' ? <textarea rows="2" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /> : <input type={type} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required={['guardian_name', 'guardian_relation', 'guardian_phone'].includes(key)} />}</label>)}{documentControl('guardian', 'Guardian document')}</div> : null}</fieldset>
      <div className="student-form-actions"><button className="primary-button small-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create guardian'}</button><button className="quiet-button" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
    </form>}
  </section>
}
