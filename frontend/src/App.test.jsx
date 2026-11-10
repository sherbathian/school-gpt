import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import App from './App.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('school setup page', () => {
  it('shows a connected state when the API and database are healthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', services: { database: 'connected' } }),
    }))

    render(<App />)

    expect(await screen.findByText('API and database are connected.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A clearer way to run your school.' })).toBeInTheDocument()
  })

  it('explains how to recover when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<App />)

    expect(await screen.findByText('Can’t reach the API. Start the Laravel server and try again.')).toBeInTheDocument()
  })
})
