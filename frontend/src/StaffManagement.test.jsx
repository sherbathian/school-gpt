import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffManagement from './StaffManagement.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('staff management', () => {
  it('loads school lookups and creates a staff member', async () => {
    const user = userEvent.setup()
    const school = { id: 2 }
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools/2/staff' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/staff-lookups/designations') return { ok: true, json: async () => ({ data: [{ id: 3, title: 'Teacher' }] }) }
      if (path === '/api/schools/2/staff-lookups/departments') return { ok: true, json: async () => ({ data: [{ id: 4, title: 'Science' }] }) }
      if (path === '/api/schools/2/staff-lookups/leave-types') return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/sessions') return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/users') return { ok: true, json: async () => ({ data: [{ id: 8, name: 'Amina Khan', email: 'amina@example.test' }] }) }
      if (path === '/api/schools/2/staff' && options.method === 'POST') {
        const fields = JSON.parse(options.body)
        return { ok: true, json: async () => ({ data: { id: 10, ...fields, designation: 'Teacher', department: 'Science', status: 'active' } }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<StaffManagement school={school} canManage />)
    await user.type(await screen.findByLabelText('Staff number'), 'ST-10')
    await user.type(screen.getByLabelText('Staff first name'), 'Amina')
    await user.type(screen.getByLabelText('Staff last name'), 'Khan')
    await user.selectOptions(screen.getByLabelText('Designation'), '3')
    await user.selectOptions(screen.getByLabelText('Department'), '4')
    await user.type(screen.getByLabelText('Birth date'), '1995-04-20')
    await user.type(screen.getByLabelText('Joining date'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Add staff member' }))

    expect(await screen.findByText(/Khan, Amina/)).toBeInTheDocument()
  })

  it('keeps staff records readable to teachers while hiding admin controls', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path) => ({ ok: true, json: async () => ({ data: path.endsWith('/staff') ? [
      { id: 10, first_name: 'Amina', last_name: 'Khan', staff_no: 'ST-10', designation: 'Teacher', department: 'Science', status: 'active' },
    ] : [] }) })))

    render(<StaffManagement school={{ id: 2 }} canManage={false} />)

    expect(await screen.findByText(/Khan, Amina/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add staff member' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Basic salary')).not.toBeInTheDocument()
  })
})
