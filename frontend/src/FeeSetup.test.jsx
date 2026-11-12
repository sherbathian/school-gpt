import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeeSetup from './FeeSetup.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('fee setup', () => {
  it('creates fee types, grade groups, and session fee masters', async () => {
    const user = userEvent.setup()
    const school = { id: 2 }
    let feeTypes = [{ id: 1, title: 'Tuition', description: '', status: 'active', academic_year: null, amount: null }]
    let groups = []
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      if (path === '/api/schools/2/fee-types' && !options.method) return { ok: true, json: async () => ({ data: feeTypes }) }
      if (path === '/api/schools/2/fee-discounts' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/fee-groups' && !options.method) return { ok: true, json: async () => ({ data: groups }) }
      if (path === '/api/schools/2/grades') return { ok: true, json: async () => ({ data: [{ id: 4, title: 'Grade 1' }] }) }
      if (path === '/api/schools/2/sessions') return { ok: true, json: async () => ({ data: [{ id: 5, title: '2026-2027', status: 'active' }] }) }
      if (path === '/api/schools/2/fee-masters' && !options.method) return { ok: true, json: async () => ({ data: [] }) }
      if (path === '/api/schools/2/fee-types' && options.method === 'POST') {
        feeTypes = [...feeTypes, { id: 2, title: 'Books', description: 'Textbooks', status: 'active', amount: null }]
        return { ok: true, json: async () => ({ data: feeTypes[1] }) }
      }
      if (path === '/api/schools/2/fee-discounts' && options.method === 'POST') {
        return { ok: true, json: async () => ({ data: { id: 6, title: 'Sibling', discount_type: 'percentage', value: '10.00', description: null } }) }
      }
      if (path === '/api/schools/2/fee-groups' && options.method === 'POST') {
        const payload = JSON.parse(options.body)
        groups = [{ id: 8, ...payload, grades: [{ id: 4, title: 'Grade 1' }] }]
        return { ok: true, json: async () => ({ data: groups[0] }) }
      }
      if (path === '/api/schools/2/fee-masters' && options.method === 'POST') {
        return { ok: true, json: async () => ({ data: {
          id: 9, school_session: { id: 5, title: '2026-2027' }, fee_group: { id: 8, title: 'Primary' },
          fee_type: { id: 1, title: 'Tuition' }, due_date: '2026-09-01', amount: '100.00', fine_type: 'none', fine_value: '0.00',
        } }) }
      }
      throw new Error(`Unexpected request: ${path}`)
    }))

    render(<FeeSetup school={school} />)
    await user.type(await screen.findByLabelText('Fee type title'), 'Books')
    await user.type(screen.getByLabelText('Fee type description'), 'Textbooks')
    await user.click(screen.getByRole('button', { name: 'Add fee type' }))
    expect(await screen.findByText('Books · Textbooks')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Discount title'), 'Sibling')
    await user.type(screen.getByLabelText(/Value/), '10.00')
    await user.click(screen.getByRole('button', { name: 'Add discount' }))
    expect(await screen.findByText('Sibling · percentage · 10.00')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Group title'), 'Primary')
    await user.click(screen.getByLabelText('Grade 1'))
    await user.click(screen.getByRole('button', { name: 'Add fee group' }))
    expect(await screen.findByText(/Primary · Grades: Grade 1/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('School session'), '5')
    await user.selectOptions(screen.getByLabelText('Fee group'), '8')
    await user.selectOptions(screen.getByLabelText('Fee type'), '1')
    await user.type(screen.getByLabelText('Due date'), '2026-09-01')
    await user.type(screen.getByLabelText('Master amount'), '100.00')
    await user.click(screen.getByRole('button', { name: 'Add fee master' }))
    expect(await screen.findByText(/2026-2027 · Primary · Tuition · 100.00/)).toBeInTheDocument()
  })
})
