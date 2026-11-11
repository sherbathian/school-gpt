import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SchoolWorkspace from './SchoolWorkspace.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const superAdmin = { id: 1, name: 'Tahir', email: 'admin@example.test', is_super_admin: true }

describe('school workspace', () => {
  it('creates a school and displays the saved record', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools' && options.method === 'POST') {
        return { ok: true, json: async () => ({ data: { id: 3, name: 'North School', slug: 'north-school', status: 'active', role: 'super_admin' } }) }
      }
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [] }) }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={superAdmin} onLogout={vi.fn()} />)

    await user.type(await screen.findByLabelText('School name'), 'North School')
    await user.click(screen.getByRole('button', { name: 'Add school' }))

    expect(await screen.findByRole('heading', { name: 'North School' })).toBeInTheDocument()
    expect(screen.getByText(/north-school/)).toBeInTheDocument()
  })

  it('lets a school admin add an existing teacher account to their school', async () => {
    const user = userEvent.setup()
    const school = { id: 2, name: 'North School', slug: 'north-school', status: 'active', role: 'school_admin' }
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [school] }) }
      if (path === '/api/schools/2/grades' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/sections' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/subjects' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/users' && options.method === undefined) {
        return { ok: true, json: async () => ({ data: [] }) }
      }
      if (path === '/api/schools/2/users' && options.method === 'POST') {
        return { ok: true, json: async () => ({ data: { id: 5, name: 'Teacher Example', email: 'teacher@example.test', role: 'teacher', is_active: true } }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={{ ...superAdmin, is_super_admin: false }} onLogout={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Manage school team' }))
    await user.type(await screen.findByLabelText('Add an existing account by email'), 'teacher@example.test')
    await user.click(screen.getByRole('button', { name: 'Add', exact: true }))

    expect(await screen.findByText('Teacher Example')).toBeInTheDocument()
    expect(screen.getByText('teacher')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'New member role' })).not.toBeInTheDocument()
  })

  it('creates a section and a grade assigned to that section', async () => {
    const user = userEvent.setup()
    const school = { id: 2, name: 'North School', slug: 'north-school', status: 'active', role: 'school_admin' }
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [school] }) }
      if (path === '/api/schools/2/grades' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/sections' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/subjects' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/sections' && options.method === 'POST') return { ok: true, json: async () => ({ data: { id: 8, title: 'Blue', status: 'active' } }) }
      if (path === '/api/schools/2/grades' && options.method === 'POST') return { ok: true, json: async () => ({ data: { id: 4, title: 'Grade 1', status: 'active', sections: [{ id: 8, title: 'Blue', status: 'active' }] } }) }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={{ ...superAdmin, is_super_admin: false }} onLogout={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'View academic structure' }))
    await user.type(await screen.findByLabelText('New section name'), 'Blue')
    await user.click(screen.getByRole('button', { name: 'Add section' }))
    await user.type(screen.getByLabelText('New grade name'), 'Grade 1')
    await user.click(screen.getByLabelText('Blue'))
    await user.click(screen.getByRole('button', { name: 'Add grade' }))

    expect(await screen.findByRole('heading', { name: 'Grade 1' })).toBeInTheDocument()
    expect(screen.getByText('Sections: Blue')).toBeInTheDocument()
  })

  it('creates a subject assigned to an active grade', async () => {
    const user = userEvent.setup()
    const school = { id: 2, name: 'North School', slug: 'north-school', status: 'active', role: 'school_admin' }
    const grade = { id: 4, title: 'Grade 1', status: 'active', sections: [] }
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [school] }) }
      if (path === '/api/schools/2/grades' && !options.method) return { ok: true, json: async () => ({ data: [grade] }) }
      if (path === '/api/schools/2/sections' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/subjects' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/subjects' && options.method === 'POST') {
        return { ok: true, json: async () => ({ data: { id: 9, title: 'Science', status: 'active', grades: [{ id: 4, title: 'Grade 1', status: 'active' }] } }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={{ ...superAdmin, is_super_admin: false }} onLogout={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'View academic structure' }))
    await user.type(await screen.findByLabelText('New subject name'), 'Science')
    await user.click(screen.getByLabelText('Grade 1', { selector: 'input' }))
    await user.click(screen.getByRole('button', { name: 'Add subject' }))

    expect(await screen.findByRole('heading', { name: 'Science' })).toBeInTheDocument()
    expect(screen.getByText('Grades: Grade 1')).toBeInTheDocument()
  })

  it('adds a student and enrolls them in a grade and assigned section', async () => {
    const user = userEvent.setup()
    const school = { id: 2, name: 'North School', slug: 'north-school', status: 'active', role: 'school_admin' }
    const grade = { id: 4, title: 'Grade 1', status: 'active', sections: [{ id: 8, title: 'Blue', status: 'active' }] }
    let studentList = []
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [school] }) }
      if (path === '/api/schools/2/students' && !options.method) return { ok: true, json: async () => ({ data: studentList }) }
      if (path === '/api/schools/2/grades' && !options.method) return { ok: true, json: async () => ({ data: [grade] }) }
      if (path === '/api/schools/2/students' && options.method === 'POST') {
        const fields = JSON.parse(options.body)
        studentList = [{ id: 13, ...fields, status: 'active', current_enrollment: null, enrollments: [] }]
        return { ok: true, json: async () => ({ data: studentList[0] }) }
      }
      if (path === '/api/schools/2/students/13/enrollments' && options.method === 'POST') {
        studentList = [{ ...studentList[0], current_enrollment: { id: 3, academic_year: '2026-2027', grade, section: grade.sections[0] }, enrollments: [] }]
        return { ok: true, json: async () => ({ data: studentList[0].current_enrollment }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={{ ...superAdmin, is_super_admin: false }} onLogout={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'View student roster' }))
    await user.type(await screen.findByLabelText('Admission number'), 'N-1001')
    await user.type(screen.getByLabelText('First name'), 'Amina')
    await user.type(screen.getByLabelText('Last name'), 'Khan')
    await user.click(screen.getByRole('button', { name: 'Add student' }))
    await user.click(await screen.findByRole('button', { name: 'Enroll' }))
    await user.selectOptions(screen.getByLabelText('Section', { selector: 'select' }), '8')
    await user.click(screen.getByRole('button', { name: 'Save enrollment' }))

    expect(await screen.findByText(/Blue · 2026-2027/)).toBeInTheDocument()
  })

  it('filters the roster by academic year and lets an admin edit and restore an archived student', async () => {
    const user = userEvent.setup()
    const school = { id: 2, name: 'North School', slug: 'north-school', status: 'active', role: 'school_admin' }
    const archivedStudent = {
      id: 13,
      admission_number: 'N-1001',
      first_name: 'Amina',
      last_name: 'Khan',
      status: 'inactive',
      current_enrollment: null,
      enrollments: [{
        id: 3,
        academic_year: '2025-2026',
        status: 'withdrawn',
        grade: { id: 4, title: 'Grade 1' },
        section: { id: 8, title: 'Blue' },
      }],
    }
    let studentList = [archivedStudent]
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [school] }) }
      if (path === '/api/schools/2/students' && !options.method) return { ok: true, json: async () => ({ data: studentList }) }
      if (path === '/api/schools/2/grades' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/students/13' && options.method === 'PATCH') {
        const changes = JSON.parse(options.body)
        studentList = [{ ...studentList[0], ...changes }]
        return { ok: true, json: async () => ({ data: studentList[0] }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={{ ...superAdmin, is_super_admin: false }} onLogout={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'View student roster' }))
    await user.selectOptions(await screen.findByLabelText('Academic year'), '2025-2026')
    expect(await screen.findByText(/Blue · 2025-2026 · withdrawn/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getAllByLabelText('Last name')[1])
    await user.type(screen.getAllByLabelText('Last name')[1], 'Ali')
    await user.click(screen.getByRole('button', { name: 'Save student' }))
    expect(await screen.findByText('Ali, Amina')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(await screen.findByText(/N-1001 · active/)).toBeInTheDocument()
  })

  it('loads a class attendance register and saves daily statuses', async () => {
    const user = userEvent.setup()
    const school = { id: 2, name: 'North School', slug: 'north-school', status: 'active', role: 'school_admin' }
    const grade = { id: 4, title: 'Grade 1', status: 'active', sections: [{ id: 8, title: 'Blue', status: 'active' }] }
    const student = {
      id: 13,
      admission_number: 'N-1001',
      first_name: 'Amina',
      last_name: 'Khan',
      status: 'active',
      current_enrollment: { id: 30, academic_year: '2026-2027', status: 'active', grade, section: grade.sections[0] },
      enrollments: [{ id: 30, academic_year: '2026-2027', status: 'active', grade, section: grade.sections[0] }],
    }
    const attendanceRow = {
      enrollment_id: 30,
      student: { id: 13, admission_number: 'N-1001', first_name: 'Amina', last_name: 'Khan' },
      grade: { id: 4, title: 'Grade 1' },
      section: { id: 8, title: 'Blue' },
      academic_year: '2026-2027',
      status: null,
    }
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [school] }) }
      if (path === '/api/schools/2/students' && !options.method) return { ok: true, json: async () => ({ data: [student] }) }
      if (path === '/api/schools/2/grades' && !options.method) return { ok: true, json: async () => ({ data: [grade] }) }
      if (path.startsWith('/api/schools/2/attendance?')) return { ok: true, json: async () => ({ data: [attendanceRow] }) }
      if (path === '/api/schools/2/attendance' && options.method === 'PUT') {
        return { ok: true, json: async () => ({ data: [{ ...attendanceRow, status: JSON.parse(options.body).records[0].status }] }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={{ ...superAdmin, is_super_admin: false }} onLogout={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'View student roster' }))
    await user.click(screen.getByRole('button', { name: 'Take attendance' }))
    await user.selectOptions(screen.getByLabelText('Grade'), '4')
    await user.selectOptions(screen.getByLabelText('Section'), '8')
    await user.click(screen.getByRole('button', { name: 'Load class' }))
    await user.selectOptions(await screen.findByLabelText('Attendance for Amina Khan'), 'present')
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))

    expect(await screen.findByLabelText('Attendance for Amina Khan')).toHaveValue('present')
  })

  it('creates a fee item, issues a student invoice, and records a payment', async () => {
    const user = userEvent.setup()
    const school = { id: 2, name: 'North School', slug: 'north-school', status: 'active', role: 'school_admin' }
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const student = {
      id: 13,
      admission_number: 'N-1001',
      first_name: 'Amina',
      last_name: 'Ali',
      status: 'active',
      current_enrollment: { id: 30, academic_year: academicYear, status: 'active', grade: { id: 4, title: 'Grade 1' }, section: { id: 8, title: 'Blue' } },
      enrollments: [],
    }
    let feeTypes = []
    let invoices = []
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools') return { ok: true, json: async () => ({ data: [school] }) }
      if (path === `/api/schools/2/fee-types?academic_year=${academicYear}` && !options.method) return { ok: true, json: async () => ({ data: feeTypes }) }
      if (path === `/api/schools/2/fee-invoices?academic_year=${academicYear}` && !options.method) return { ok: true, json: async () => ({ data: invoices }) }
      if (path === `/api/schools/2/students?academic_year=${academicYear}` && !options.method) return { ok: true, json: async () => ({ data: [student] }) }
      if (path === '/api/schools/2/fee-types' && options.method === 'POST') {
        const values = JSON.parse(options.body)
        feeTypes = [{ id: 5, ...values, amount: values.amount, status: 'active' }]
        return { ok: true, json: async () => ({ data: feeTypes[0] }) }
      }
      if (path === '/api/schools/2/fee-invoices' && options.method === 'POST') {
        invoices = [{
          id: 22,
          student,
          fee_type: { id: 5, title: 'Tuition' },
          academic_year: academicYear,
          amount: '125.50',
          amount_paid: '0.00',
          balance: '125.50',
          due_date: null,
          status: 'open',
          payments: [],
        }]
        return { ok: true, json: async () => ({ data: invoices[0] }) }
      }
      if (path === '/api/schools/2/fee-invoices/22/payments' && options.method === 'POST') {
        invoices = [{ ...invoices[0], amount_paid: '25.50', balance: '100.00', status: 'partial', payments: [{ id: 1, amount: '25.50', paid_on: '2026-11-11', reference: null }] }]
        return { ok: true, json: async () => ({ data: invoices[0] }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolWorkspace user={{ ...superAdmin, is_super_admin: false }} onLogout={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Manage fees' }))
    await user.type(await screen.findByLabelText('Fee item name'), 'Tuition')
    await user.type(screen.getByLabelText('Amount'), '125.50')
    await user.click(screen.getByRole('button', { name: 'Add fee item' }))
    await user.selectOptions(await screen.findByLabelText('Student'), '13')
    await user.selectOptions(screen.getByLabelText('Fee item'), '5')
    await user.click(screen.getByRole('button', { name: 'Issue invoice' }))
    await user.type(await screen.findByLabelText('Payment amount for invoice 22'), '25.50')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))

    expect(await screen.findByText(/Paid 25\.50 · Balance 100\.00/)).toBeInTheDocument()
  })
})
