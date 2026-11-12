import { Fragment, useEffect, useState } from 'react'
import { apiRequest } from './api.js'
import DataTools from './DataTools.jsx'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const validationMessage = Object.values(result.errors || {}).flat()[0]
    throw new Error(validationMessage || result.message || 'That request could not be completed.')
  }
  return result.data
}

function currentAcademicYear() {
  const year = new Date().getFullYear()
  return `${year}-${year + 1}`
}

function todayDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function StudentRoster({ school, canManage, canTakeAttendance, expanded = false, attendanceOnly = false, standalone = false }) {
  const [open, setOpen] = useState(expanded)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState([])
  const [grades, setGrades] = useState([])
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [studentForm, setStudentForm] = useState({ admission_number: '', first_name: '', last_name: '', gender: 'male', religion: '', email: '', phone: '', address: '', birth_date: '', b_form_number: '', admission_date: todayDate(), previous_school_details: '', note: '', guardian: { father_name: '', father_phone: '', father_occupation: '', father_cnic: '', mother_name: '', mother_phone: '', mother_occupation: '', mother_cnic: '', is_guardian_other: false, guardian_name: '', guardian_relation: '', guardian_email: '', guardian_phone: '', guardian_occupation: '', guardian_cnic: '', guardian_address: '' } })
  const [showStudentForm, setShowStudentForm] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [bFormFile, setBFormFile] = useState(null)
  const [search, setSearch] = useState('')
  const [activeStudentId, setActiveStudentId] = useState(null)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const [editAdmissionNumber, setEditAdmissionNumber] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const academicYear = school.active_session?.academic_year || currentAcademicYear()
  const [attendanceOpen, setAttendanceOpen] = useState(attendanceOnly)
  const [attendanceDate, setAttendanceDate] = useState(todayDate)
  const attendanceYear = school.active_session?.academic_year || currentAcademicYear()
  const [attendanceGradeId, setAttendanceGradeId] = useState('')
  const [attendanceSectionId, setAttendanceSectionId] = useState('')
  const [attendanceRows, setAttendanceRows] = useState([])
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open || loaded) return undefined
    const controller = new AbortController()

    async function loadRoster() {
      setLoading(true)
      setError('')
      try {
        const [studentResponse, gradeResponse] = await Promise.all([
          apiRequest(`/api/schools/${school.id}/students?academic_year=${encodeURIComponent(academicYear)}`, { signal: controller.signal }),
          apiRequest(`/api/schools/${school.id}/grades`, { signal: controller.signal }),
        ])
        const [studentData, gradeData] = await Promise.all([readData(studentResponse), readData(gradeResponse)])
        setStudents(studentData)
        setGrades(gradeData)
        setGradeId(String(gradeData.find((grade) => grade.status === 'active')?.id || ''))
        setAttendanceGradeId(String(gradeData.find((grade) => grade.status === 'active')?.id || ''))
        setLoaded(true)
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadRoster()
    return () => controller.abort()
  }, [open, loaded, school.id, academicYear])

  const selectedGrade = grades.find((grade) => String(grade.id) === gradeId)
  const availableSections = selectedGrade?.sections.filter((section) => section.status === 'active') || []
  const attendanceGrade = grades.find((grade) => String(grade.id) === attendanceGradeId)
  const attendanceSections = attendanceGrade?.sections.filter((section) => section.status === 'active') || []
  const visibleStudents = students.filter((student) => `${student.admission_number} ${student.first_name} ${student.last_name} ${student.phone || ''} ${student.email || ''} ${student.current_enrollment?.grade?.title || ''} ${student.current_enrollment?.section?.title || ''}`.toLowerCase().includes(search.trim().toLowerCase()))

  function enrollmentForYear(student) {
    return student.enrollments.find((enrollment) => enrollment.academic_year === academicYear) || null
  }

  async function createStudent(event) {
    event.preventDefault()
    setError('')
    try {
      const payload = new FormData()
      Object.entries(studentForm).filter(([key]) => key !== 'guardian').forEach(([key, value]) => { if (value !== '' && value != null) payload.append(key, value) })
      Object.entries(studentForm.guardian).forEach(([key, value]) => { if (value !== '' && value != null) payload.append(`guardian[${key}]`, typeof value === 'boolean' ? (value ? '1' : '0') : value) })
      if (photoFile) payload.append('photo', photoFile)
      if (bFormFile) payload.append('b_form_document', bFormFile)
      const student = await readData(await apiRequest(`/api/schools/${school.id}/students`, {
        method: 'POST',
        body: payload,
      }))
      setStudents((current) => [...current, student].sort((left, right) => `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`)))
      setAdmissionNumber('')
      setFirstName('')
      setLastName('')
      setStudentForm((current) => ({ ...current, admission_number: '', first_name: '', last_name: '' }))
      setShowStudentForm(false)
      setPhotoFile(null)
      setBFormFile(null)
    } catch (createError) {
      setError(createError.message)
    }
  }

  async function importStudent(row) {
    const guardian = Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('guardian_')).map(([key, value]) => [key.slice(9), value]))
    const student = await readData(await apiRequest(`/api/schools/${school.id}/students`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...row, guardian: Object.values(guardian).some(Boolean) ? guardian : undefined }),
    }))
    setStudents((current) => [...current, student].sort((left, right) => `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`)))
  }

  async function importEnrollment(row) {
    const student = students.find((item) => item.admission_number.toLowerCase() === row.admission_number.toLowerCase())
    if (!student || student.status !== 'active') throw new Error('Admission number does not match an active student in this school.')
    if (student.current_enrollment?.academic_year === academicYear && student.current_enrollment.status === 'active') {
      throw new Error('Student already has an active enrollment for this year. Use the normal move-class action to change it.')
    }
    const grade = grades.find((item) => item.title.toLowerCase() === row.grade.toLowerCase() && item.status === 'active')
    const section = grade?.sections.find((item) => item.title.toLowerCase() === row.section.toLowerCase() && item.status === 'active')
    if (!grade || !section) throw new Error('Grade and section must match an active assigned class in this school.')
    await readData(await apiRequest(`/api/schools/${school.id}/students/${student.id}/enrollments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade_id: grade.id, section_id: section.id, academic_year: academicYear }),
    }))
    setStudents(await readData(await apiRequest(`/api/schools/${school.id}/students?academic_year=${encodeURIComponent(academicYear)}`)))
  }

  async function enrollStudent(event, student) {
    event.preventDefault()
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/students/${student.id}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade_id: Number(gradeId), section_id: Number(sectionId), academic_year: academicYear }),
      }))
      const refreshed = await readData(await apiRequest(`/api/schools/${school.id}/students`))
      setStudents(refreshed)
      setActiveStudentId(null)
    } catch (enrollError) {
      setError(enrollError.message)
    }
  }

  async function archiveStudent(student) {
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/students/${student.id}`, { method: 'DELETE' }))
      setStudents(await readData(await apiRequest(`/api/schools/${school.id}/students`)))
    } catch (archiveError) {
      setError(archiveError.message)
    }
  }

  async function restoreStudent(student) {
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      }))
      setStudents(await readData(await apiRequest(`/api/schools/${school.id}/students`)))
    } catch (restoreError) {
      setError(restoreError.message)
    }
  }

  async function saveStudent(event, student) {
    event.preventDefault()
    setError('')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admission_number: editAdmissionNumber,
          first_name: editFirstName,
          last_name: editLastName,
        }),
      }))
      setStudents(await readData(await apiRequest(`/api/schools/${school.id}/students`)))
      setEditingStudentId(null)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function loadAttendance(event) {
    event.preventDefault()
    setError('')
    setAttendanceLoaded(false)
    setAttendanceLoading(true)
    try {
      const query = new URLSearchParams({
        grade_id: attendanceGradeId,
        section_id: attendanceSectionId,
        academic_year: attendanceYear,
        attendance_date: attendanceDate,
      })
      const rows = await readData(await apiRequest(`/api/schools/${school.id}/attendance?${query}`))
      setAttendanceRows(rows)
      setAttendanceLoaded(true)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setAttendanceLoading(false)
    }
  }

  function updateAttendance(enrollmentId, status) {
    setAttendanceRows((current) => current.map((row) => row.enrollment_id === enrollmentId ? { ...row, status } : row))
  }

  async function saveAttendance() {
    setError('')
    setAttendanceSaving(true)
    try {
      const savedRows = await readData(await apiRequest(`/api/schools/${school.id}/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade_id: Number(attendanceGradeId),
          section_id: Number(attendanceSectionId),
          academic_year: attendanceYear,
          attendance_date: attendanceDate,
          records: attendanceRows.map((row) => ({ enrollment_id: row.enrollment_id, status: row.status })),
        }),
      }))
      setAttendanceRows(savedRows)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setAttendanceSaving(false)
    }
  }

  async function importAttendance(records) {
    const byAdmission = new Map(records.map((record) => [record.admission_number.toLowerCase(), record.status.toLowerCase()]))
    if (records.length !== attendanceRows.length || attendanceRows.some((row) => !byAdmission.has(row.student.admission_number.toLowerCase()))) {
      throw new Error('Include exactly one row for every student in the loaded class register.')
    }
    const invalidStatus = [...byAdmission.values()].find((status) => !['present', 'absent', 'late', 'excused'].includes(status))
    if (invalidStatus) throw new Error('Attendance status must be present, absent, late, or excused.')
    const saved = await readData(await apiRequest(`/api/schools/${school.id}/attendance`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade_id: Number(attendanceGradeId), section_id: Number(attendanceSectionId), academic_year: attendanceYear, attendance_date: attendanceDate, records: attendanceRows.map((row) => ({ enrollment_id: row.enrollment_id, status: byAdmission.get(row.student.admission_number.toLowerCase()) })) }),
    }))
    setAttendanceRows(saved)
    return { count: saved.length }
  }

  return (
    <div className={`academic-structure${attendanceOnly ? ' attendance-only' : ''}`}>
      {!standalone ? <button className="team-toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? 'Hide student roster' : 'View student roster'}
      </button> : null}
      {open ? (
        <div className="academic-panel">
          <div className="academic-section-heading">
            <h4>Students</h4>
            <span>{visibleStudents.length}</span>
          </div>
          <DataTools title="Students" rows={students.map((student) => {
            const enrollment = enrollmentForYear(student)
            return { ...student, ...Object.fromEntries(Object.entries(student.guardian || {}).map(([key, value]) => [`guardian_${key}`, value])), grade: enrollment?.grade?.title || '', section: enrollment?.section?.title || '', academic_year: enrollment?.academic_year || '', enrollment_history: student.enrollments.map((item) => `${item.academic_year}: ${item.grade.title} / ${item.section.title} (${item.status})`).join(' | ') }
          })} fields={[{ key: 'admission_number', label: 'admission_number', required: true }, { key: 'first_name', label: 'first_name', required: true }, { key: 'last_name', label: 'last_name', required: true }, ...['gender', 'religion', 'email', 'phone', 'address', 'birth_date', 'b_form_number', 'admission_date', 'previous_school_details', 'note'].map((key) => ({ key, label: key })), ...['father_name', 'father_phone', 'father_occupation', 'father_cnic', 'mother_name', 'mother_phone', 'mother_occupation', 'mother_cnic', 'is_guardian_other', 'guardian_name', 'guardian_relation', 'guardian_email', 'guardian_phone', 'guardian_occupation', 'guardian_cnic', 'guardian_address'].map((key) => ({ key: `guardian_${key}`, label: `guardian_${key}` }))]} exportFields={['admission_number', 'first_name', 'last_name', 'gender', 'religion', 'email', 'phone', 'address', 'birth_date', 'b_form_number', 'admission_date', 'leave_date', 'status', 'previous_school_details', 'note', 'guardian_father_name', 'guardian_father_phone', 'guardian_mother_name', 'guardian_mother_phone', 'guardian_guardian_name', 'guardian_guardian_relation', 'guardian_guardian_phone', 'guardian_guardian_email', 'grade', 'section', 'academic_year', 'enrollment_history'].map((key) => ({ key, label: key }))} canImport={canManage} onImport={importStudent} />
          <span className="active-year-label">Active academic year <strong>{academicYear}</strong></span>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {loading ? <p className="muted-copy" role="status">Loading student roster…</p> : null}
          {!loading && canManage && !attendanceOnly && !showStudentForm ? <div className="roster-toolbar"><label className="module-search"><span aria-hidden="true">⌕</span><input aria-label="Search students" placeholder="Search students by name, admission no., phone, grade or section" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="primary-button small-button" type="button" onClick={() => setShowStudentForm(true)}>＋ Add student</button></div> : null}
          {showStudentForm && canManage ? <form className="student-profile-form" onSubmit={createStudent}>
            <div className="student-form-heading"><div><h4>Student admission</h4><p>Enter the student profile and family contact details.</p></div><button className="quiet-button" type="button" onClick={() => setShowStudentForm(false)}>Cancel</button></div>
            <fieldset><legend>Student profile</legend><div className="student-form-grid">
              {[
                ['admission_number', 'Admission number', 'text', true], ['first_name', 'First name', 'text', true], ['last_name', 'Last name', 'text', true], ['gender', 'Gender', 'select', true], ['birth_date', 'Birth date', 'date', false], ['admission_date', 'Admission date', 'date', false], ['leave_date', 'Leave date', 'date', false], ['status', 'Admission status', 'status', false], ['religion', 'Religion', 'text', false], ['email', 'Email', 'email', false], ['phone', 'Phone', 'tel', false], ['b_form_number', 'B-Form number', 'text', false], ['address', 'Address', 'textarea', false], ['previous_school_details', 'Previous school details', 'textarea', false], ['note', 'Notes', 'textarea', false],
              ].map(([key, label, type, required]) => <label key={key}>{label}{type === 'select' ? <select value={studentForm[key]} onChange={(event) => setStudentForm({ ...studentForm, [key]: event.target.value })}><option value="male">Male</option><option value="female">Female</option></select> : type === 'status' ? <select value={studentForm[key] || 'active'} onChange={(event) => setStudentForm({ ...studentForm, [key]: event.target.value })}><option value="pending">Pending</option><option value="active">Active</option><option value="leave">Leave</option><option value="alumni">Alumni</option></select> : type === 'textarea' ? <textarea rows="2" value={studentForm[key]} onChange={(event) => setStudentForm({ ...studentForm, [key]: event.target.value })} /> : <input type={type} value={studentForm[key]} onChange={(event) => setStudentForm({ ...studentForm, [key]: event.target.value })} required={required} />}</label>)}
              <label>Student photo<input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} /></label>
              <label>B-Form document<input type="file" accept=".pdf,image/*" onChange={(event) => setBFormFile(event.target.files?.[0] || null)} /></label>
            </div></fieldset>
            <fieldset><legend>Parent / guardian details</legend><div className="student-form-grid">
              {['father_name', 'father_phone', 'father_occupation', 'father_cnic', 'mother_name', 'mother_phone', 'mother_occupation', 'mother_cnic'].map((key) => <label key={key}>{key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}<input value={studentForm.guardian[key]} onChange={(event) => setStudentForm({ ...studentForm, guardian: { ...studentForm.guardian, [key]: event.target.value } })} /></label>)}
              <label className="student-form-check"><input type="checkbox" checked={studentForm.guardian.is_guardian_other} onChange={(event) => setStudentForm({ ...studentForm, guardian: { ...studentForm.guardian, is_guardian_other: event.target.checked } })} /> Other guardian</label>
              {studentForm.guardian.is_guardian_other ? ['guardian_name', 'guardian_relation', 'guardian_phone', 'guardian_email', 'guardian_occupation', 'guardian_cnic', 'guardian_address'].map((key) => <label key={key}>{key.replace('guardian_', '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}<input value={studentForm.guardian[key]} onChange={(event) => setStudentForm({ ...studentForm, guardian: { ...studentForm.guardian, [key]: event.target.value } })} required={['guardian_name', 'guardian_relation', 'guardian_phone'].includes(key)} /></label>) : null}
            </div></fieldset>
            <div className="student-form-actions"><button className="primary-button small-button" type="submit">Save student</button><button className="quiet-button" type="button" onClick={() => setShowStudentForm(false)}>Cancel</button></div>
          </form> : null}
          {!loading && visibleStudents.length ? (
            <div className="crud-table-wrap"><table className="crud-table"><thead><tr><th>Student</th><th>Current enrollment</th><th>Actions</th></tr></thead><tbody>
              {visibleStudents.map((student) => {
                const displayedEnrollment = enrollmentForYear(student)

                return (
                <Fragment key={student.id}>
                  <tr className="student-row">
                    <td>{student.last_name}, {student.first_name}<small>{student.admission_number} · {student.status}</small></td>
                    <td>{displayedEnrollment ? `${displayedEnrollment.grade.title} · ${displayedEnrollment.section.title}` : student.status === 'active' ? 'Not enrolled this year' : 'Archived'}<small>{displayedEnrollment?.academic_year || ''}{displayedEnrollment ? ` · ${displayedEnrollment.status}` : ''}</small></td>
                    <td>{canManage ? <div className="academic-actions">
                      <button className="quiet-button" type="button" onClick={() => {
                        setEditAdmissionNumber(student.admission_number)
                        setEditFirstName(student.first_name)
                        setEditLastName(student.last_name)
                        setEditingStudentId(editingStudentId === student.id ? null : student.id)
                        setActiveStudentId(null)
                      }}>{editingStudentId === student.id ? 'Cancel edit' : 'Edit'}</button>
                      {student.status === 'active' ? (
                        <>
                          <button className="quiet-button" type="button" onClick={() => {
                            setActiveStudentId(activeStudentId === student.id ? null : student.id)
                            setEditingStudentId(null)
                            setGradeId(String(grades.find((grade) => grade.status === 'active')?.id || ''))
                            setSectionId('')
                          }}>{student.current_enrollment ? 'Move class' : 'Enroll'}</button>
                          <button className="quiet-button danger-action" type="button" onClick={() => archiveStudent(student)}>Archive</button>
                        </>
                      ) : <button className="quiet-button" type="button" onClick={() => restoreStudent(student)}>Restore</button>}
                    </div> : null}</td>
                  </tr>
                  {editingStudentId === student.id ? <tr><td colSpan="3"><form className="student-edit-form" onSubmit={(event) => saveStudent(event, student)}>
                    <label htmlFor={`edit-admission-${student.id}`}>Admission number</label><input id={`edit-admission-${student.id}`} value={editAdmissionNumber} onChange={(event) => setEditAdmissionNumber(event.target.value)} required />
                    <label htmlFor={`edit-first-${student.id}`}>First name</label><input id={`edit-first-${student.id}`} value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} required />
                    <label htmlFor={`edit-last-${student.id}`}>Last name</label><input id={`edit-last-${student.id}`} value={editLastName} onChange={(event) => setEditLastName(event.target.value)} required />
                    <button className="primary-button small-button" type="submit">Save student</button><button className="quiet-button" type="button" onClick={() => setEditingStudentId(null)}>Cancel</button>
                  </form></td></tr> : null}
                  {activeStudentId === student.id ? <tr><td colSpan="3"><form className="enrollment-form" onSubmit={(event) => enrollStudent(event, student)}>
                      <label htmlFor={`enrollment-grade-${student.id}`}>Grade</label>
                      <select id={`enrollment-grade-${student.id}`} value={gradeId} onChange={(event) => {
                        setGradeId(event.target.value)
                        setSectionId('')
                      }} required>
                        <option value="">Choose a grade</option>
                        {grades.filter((grade) => grade.status === 'active').map((grade) => <option key={grade.id} value={grade.id}>{grade.title}</option>)}
                      </select>
                      <label htmlFor={`enrollment-section-${student.id}`}>Section</label>
                      <select id={`enrollment-section-${student.id}`} value={sectionId} onChange={(event) => setSectionId(event.target.value)} required>
                        <option value="">Choose a section</option>
                        {availableSections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
                      </select>
                      <span className="active-year-label">Academic year <strong>{school.active_session?.academic_year || academicYear}</strong></span>
                      <button className="primary-button small-button" type="submit" disabled={!sectionId}>Save enrollment</button>
                      <button className="quiet-button" type="button" onClick={() => setActiveStudentId(null)}>Cancel</button>
                  </form></td></tr> : null}
                </Fragment>
                )
              })}
            </tbody></table></div>
          ) : null}
          {!loading && visibleStudents.length === 0 ? <p className="muted-copy">No students are enrolled for {academicYear} yet.</p> : null}
          {canTakeAttendance && (attendanceOnly || !standalone) ? (
            <>
              <button className="team-toggle attendance-toggle" type="button" aria-expanded={attendanceOpen} onClick={() => setAttendanceOpen((current) => !current)}>
                {attendanceOpen ? 'Hide attendance register' : 'Take attendance'}
              </button>
              {attendanceOpen ? (
                <section className="attendance-panel" aria-label="Class attendance">
                  <form className="attendance-filter-form" onSubmit={loadAttendance}>
                    <span className="active-year-label">Academic year <strong>{school.active_session?.academic_year || attendanceYear}</strong></span>
                    <label htmlFor={`attendance-grade-${school.id}`}>Grade</label>
                    <select id={`attendance-grade-${school.id}`} value={attendanceGradeId} onChange={(event) => {
                      setAttendanceGradeId(event.target.value)
                      setAttendanceSectionId('')
                      setAttendanceLoaded(false)
                    }} required>
                      <option value="">Choose a grade</option>
                      {grades.filter((grade) => grade.status === 'active').map((grade) => <option key={grade.id} value={grade.id}>{grade.title}</option>)}
                    </select>
                    <label htmlFor={`attendance-section-${school.id}`}>Section</label>
                    <select id={`attendance-section-${school.id}`} value={attendanceSectionId} onChange={(event) => {
                      setAttendanceSectionId(event.target.value)
                      setAttendanceLoaded(false)
                    }} required>
                      <option value="">Choose a section</option>
                      {attendanceSections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
                    </select>
                    <label htmlFor={`attendance-date-${school.id}`}>Date</label>
                    <input id={`attendance-date-${school.id}`} type="date" value={attendanceDate} onChange={(event) => {
                      setAttendanceDate(event.target.value)
                      setAttendanceLoaded(false)
                    }} required />
                    <button className="primary-button small-button" type="submit" disabled={attendanceLoading}>
                      {attendanceLoading ? 'Loading…' : 'Load class'}
                    </button>
                  </form>
                  {attendanceLoaded && attendanceRows.length ? (
                    <>
                      <DataTools title={`Attendance ${attendanceDate}`} rows={attendanceRows.map((row) => ({ admission_number: row.student.admission_number, student: `${row.student.first_name} ${row.student.last_name}`, status: row.status || '' }))} fields={[{ key: 'admission_number', label: 'admission_number', required: true }, { key: 'student', label: 'student' }, { key: 'status', label: 'status', required: true }]} canImport={canTakeAttendance} onImportBatch={importAttendance} />
                      <ul className="attendance-list">
                        {attendanceRows.map((row) => (
                          <li key={row.enrollment_id}>
                            <div className="student-summary">
                              <strong>{row.student.last_name}, {row.student.first_name}</strong>
                              <span>{row.student.admission_number}</span>
                            </div>
                            <label className="visually-hidden" htmlFor={`attendance-status-${row.enrollment_id}`}>Attendance for {row.student.first_name} {row.student.last_name}</label>
                            <select id={`attendance-status-${row.enrollment_id}`} value={row.status || ''} onChange={(event) => updateAttendance(row.enrollment_id, event.target.value)} required>
                              <option value="">Select status</option>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="late">Late</option>
                              <option value="excused">Excused</option>
                            </select>
                          </li>
                        ))}
                      </ul>
                      <button className="primary-button small-button" type="button" onClick={saveAttendance} disabled={attendanceSaving || attendanceRows.some((row) => !row.status)}>
                        {attendanceSaving ? 'Saving…' : 'Save attendance'}
                      </button>
                    </>
                  ) : null}
                  {attendanceLoaded && attendanceRows.length === 0 ? <p className="muted-copy">No students enrolled in this class on the selected date.</p> : null}
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
