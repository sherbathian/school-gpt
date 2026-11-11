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
})
