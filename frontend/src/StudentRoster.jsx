import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'

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

export default function StudentRoster({ school, canManage, canTakeAttendance }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState([])
  const [grades, setGrades] = useState([])
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [activeStudentId, setActiveStudentId] = useState(null)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const [editAdmissionNumber, setEditAdmissionNumber] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [academicYear, setAcademicYear] = useState(currentAcademicYear)
  const [academicYearFilter, setAcademicYearFilter] = useState('all')
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceDate, setAttendanceDate] = useState(todayDate)
  const [attendanceYear, setAttendanceYear] = useState(currentAcademicYear)
  const [attendanceGradeId, setAttendanceGradeId] = useState('')
  const [attendanceSectionId, setAttendanceSectionId] = useState('')
  const [attendanceRows, setAttendanceRows] = useState([])
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [error, setError] = useState('')
  const [standardAcademicYears] = useState(() => {
    const currentYear = new Date().getFullYear()

    return Array.from({ length: 6 }, (_, index) => {
      const year = currentYear - 2 + index
      return `${year}-${year + 1}`
    })
  })

  useEffect(() => {
    if (!open || loaded) return undefined
    const controller = new AbortController()

    async function loadRoster() {
      setLoading(true)
      setError('')
      try {
        const [studentResponse, gradeResponse] = await Promise.all([
          apiRequest(`/api/schools/${school.id}/students`, { signal: controller.signal }),
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
  }, [open, loaded, school.id])

  const selectedGrade = grades.find((grade) => String(grade.id) === gradeId)
  const availableSections = selectedGrade?.sections.filter((section) => section.status === 'active') || []
  const attendanceGrade = grades.find((grade) => String(grade.id) === attendanceGradeId)
  const attendanceSections = attendanceGrade?.sections.filter((section) => section.status === 'active') || []
  const academicYears = [...new Set([
    ...students.flatMap((student) => student.enrollments.map((enrollment) => enrollment.academic_year)),
    ...standardAcademicYears,
  ])].sort((left, right) => right.localeCompare(left))
  const visibleStudents = academicYearFilter === 'all'
    ? students
    : students.filter((student) => student.enrollments.some((enrollment) => enrollment.academic_year === academicYearFilter))

  function enrollmentForYear(student) {
    if (academicYearFilter === 'all') {
      return student.current_enrollment || student.enrollments[0] || null
    }

    return student.enrollments.find((enrollment) => enrollment.academic_year === academicYearFilter) || null
  }

  async function createStudent(event) {
    event.preventDefault()
    setError('')
    try {
      const student = await readData(await apiRequest(`/api/schools/${school.id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admission_number: admissionNumber, first_name: firstName, last_name: lastName }),
      }))
      setStudents((current) => [...current, student].sort((left, right) => `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`)))
      setAdmissionNumber('')
      setFirstName('')
      setLastName('')
    } catch (createError) {
      setError(createError.message)
    }
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

  return (
    <div className="academic-structure">
      <button className="team-toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? 'Hide student roster' : 'View student roster'}
      </button>
      {open ? (
        <div className="academic-panel">
          <div className="academic-section-heading">
            <h4>Students</h4>
            <span>{visibleStudents.length}</span>
          </div>
          {!loading ? (
            <div className="roster-filter">
              <label htmlFor={`roster-year-${school.id}`}>Academic year</label>
              <select id={`roster-year-${school.id}`} value={academicYearFilter} onChange={(event) => setAcademicYearFilter(event.target.value)}>
                <option value="all">All academic years</option>
                {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          ) : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {loading ? <p className="muted-copy" role="status">Loading student roster…</p> : null}
          {!loading && canManage ? (
            <form className="student-create-form" onSubmit={createStudent}>
              <label htmlFor={`admission-number-${school.id}`}>Admission number</label>
              <input id={`admission-number-${school.id}`} value={admissionNumber} onChange={(event) => setAdmissionNumber(event.target.value)} required />
              <label htmlFor={`student-first-name-${school.id}`}>First name</label>
              <input id={`student-first-name-${school.id}`} value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
              <label htmlFor={`student-last-name-${school.id}`}>Last name</label>
              <input id={`student-last-name-${school.id}`} value={lastName} onChange={(event) => setLastName(event.target.value)} required />
              <button className="primary-button small-button" type="submit">Add student</button>
            </form>
          ) : null}
          {!loading && visibleStudents.length ? (
            <ul className="student-list">
              {visibleStudents.map((student) => {
                const displayedEnrollment = enrollmentForYear(student)

                return (
                <li key={student.id} className="student-row">
                  {editingStudentId === student.id ? (
                    <form className="student-edit-form" onSubmit={(event) => saveStudent(event, student)}>
                      <label htmlFor={`edit-admission-${student.id}`}>Admission number</label>
                      <input id={`edit-admission-${student.id}`} value={editAdmissionNumber} onChange={(event) => setEditAdmissionNumber(event.target.value)} required />
                      <label htmlFor={`edit-first-${student.id}`}>First name</label>
                      <input id={`edit-first-${student.id}`} value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} required />
                      <label htmlFor={`edit-last-${student.id}`}>Last name</label>
                      <input id={`edit-last-${student.id}`} value={editLastName} onChange={(event) => setEditLastName(event.target.value)} required />
                      <button className="primary-button small-button" type="submit">Save student</button>
                      <button className="quiet-button" type="button" onClick={() => setEditingStudentId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <div className="student-summary">
                      <strong>{student.last_name}, {student.first_name}</strong>
                      <span>{student.admission_number} · {student.status}</span>
                      {displayedEnrollment ? (
                        <span>{displayedEnrollment.grade.title} · {displayedEnrollment.section.title} · {displayedEnrollment.academic_year} · {displayedEnrollment.status}</span>
                      ) : <span>{student.status === 'active' ? 'Not enrolled in this academic year' : 'Archived'}</span>}
                    </div>
                  )}
                  {canManage ? (
                    <div className="academic-actions">
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
                    </div>
                  ) : null}
                  {activeStudentId === student.id ? (
                    <form className="enrollment-form" onSubmit={(event) => enrollStudent(event, student)}>
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
                      <label htmlFor={`enrollment-year-${student.id}`}>Academic year</label>
                      <select id={`enrollment-year-${student.id}`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} required>
                        {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                      </select>
                      <button className="primary-button small-button" type="submit" disabled={!sectionId}>Save enrollment</button>
                      <button className="quiet-button" type="button" onClick={() => setActiveStudentId(null)}>Cancel</button>
                    </form>
                  ) : null}
                </li>
                )
              })}
            </ul>
          ) : null}
          {!loading && visibleStudents.length === 0 ? <p className="muted-copy">{academicYearFilter === 'all' ? 'No students yet.' : `No students enrolled in ${academicYearFilter}.`}</p> : null}
          {canTakeAttendance ? (
            <>
              <button className="team-toggle attendance-toggle" type="button" aria-expanded={attendanceOpen} onClick={() => setAttendanceOpen((current) => !current)}>
                {attendanceOpen ? 'Hide attendance register' : 'Take attendance'}
              </button>
              {attendanceOpen ? (
                <section className="attendance-panel" aria-label="Class attendance">
                  <form className="attendance-filter-form" onSubmit={loadAttendance}>
                    <label htmlFor={`attendance-year-${school.id}`}>Academic year</label>
                    <select id={`attendance-year-${school.id}`} value={attendanceYear} onChange={(event) => {
                      setAttendanceYear(event.target.value)
                      setAttendanceLoaded(false)
                    }} required>
                      {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
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
