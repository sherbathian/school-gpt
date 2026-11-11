import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mockGuestSession(loginResponse, schools = []) {
  vi.stubGlobal('fetch', vi.fn(async (path) => {
    if (path === '/api/health') return { ok: true }
    if (path === '/api/me') return { ok: false, status: 401 }
    if (path === '/sanctum/csrf-cookie') return { ok: true }
    if (path === '/api/login') return loginResponse
    if (path === '/api/schools') return { ok: true, json: async () => ({ data: schools }) }
    throw new Error(`Unexpected request: ${path}`)
  }))
}

describe('school sign-in page', () => {
  it('shows an accessible sign-in form to a guest', async () => {
    mockGuestSession()
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('status')).toHaveTextContent('School system is ready')
  })

  it('signs in and displays the schools and role returned by the API', async () => {
    const user = userEvent.setup()
    const account = {
      id: 1,
      name: 'Amina Khan',
      email: 'amina@example.test',
      is_super_admin: false,
      schools: [{ id: 2, name: 'North School', slug: 'north-school', role: 'school_admin' }],
    }
    mockGuestSession({ ok: true, json: async () => ({ data: account }) }, account.schools)
    render(<App />)

    await user.type(await screen.findByLabelText('Email address'), 'amina@example.test')
    await user.type(screen.getByLabelText('Password'), 'a long password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Welcome, Amina Khan.' })).toBeInTheDocument()
    expect(screen.getByText('North School')).toBeInTheDocument()
    expect(screen.getByText('school admin')).toBeInTheDocument()
  })

  it('shows a clear message when credentials are rejected', async () => {
    const user = userEvent.setup()
    mockGuestSession({
      ok: false,
      json: async () => ({ errors: { email: ['The provided credentials are incorrect.'] } }),
    })
    render(<App />)

    await user.type(await screen.findByLabelText('Email address'), 'wrong@example.test')
    await user.type(screen.getByLabelText('Password'), 'wrong password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The provided credentials are incorrect.')
  })
})
