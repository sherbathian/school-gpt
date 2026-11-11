import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SchoolSessions from './SchoolSessions.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('school sessions', () => {
  it('loads sessions and lets an administrator add the first current session', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools/2/sessions' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/sessions' && options.method === 'POST') {
        const data = JSON.parse(options.body)
        return { ok: true, json: async () => ({ data: { id: 7, ...data, is_current: true, status: 'active' } }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<SchoolSessions school={{ id: 2 }} canManage />)
    await user.type(await screen.findByLabelText('Session title'), '2026–2027')
    await user.type(screen.getByLabelText('Start date'), '2026-08-01')
    await user.type(screen.getByLabelText('End date'), '2027-06-30')
    await user.click(screen.getByRole('button', { name: 'Add session' }))

    expect(await screen.findByText('Current')).toBeInTheDocument()
    expect(screen.getByText('2026–2027')).toBeInTheDocument()
  })

  it('lets a teacher read sessions without an add form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [
      { id: 7, title: '2026–2027', starts_on: '2026-08-01', ends_on: '2027-06-30', is_current: true, status: 'active' },
    ] }) })))

    render(<SchoolSessions school={{ id: 2 }} canManage={false} />)

    expect(await screen.findByText('2026–2027')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add session' })).not.toBeInTheDocument()
  })
})
