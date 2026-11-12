import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTools from './DataTools.jsx'

afterEach(() => {
  cleanup()
})

describe('CSV data tools', () => {
  it('previews a CSV before importing validated rows', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<DataTools title="Sections" rows={[]} fields={[{ key: 'title', label: 'title', required: true }]} canImport onImport={onImport} />)
    const file = new File(['title\nNorth\nSouth'], 'sections.csv', { type: 'text/csv' })

    await user.upload(container.querySelector('input[type="file"]'), file)
    expect(await screen.findByText(/2 rows ready/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import valid rows' }))

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2))
    expect(onImport).toHaveBeenNthCalledWith(1, { title: 'North' })
    expect(onImport).toHaveBeenNthCalledWith(2, { title: 'South' })
    expect(await screen.findByRole('status')).toHaveTextContent('2 imported; 0 skipped or rejected.')
  })

  it('does not commit rows with missing required values', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    const { container } = render(<DataTools title="Sections" rows={[]} fields={[{ key: 'title', label: 'title', required: true }, { key: 'description', label: 'description' }]} canImport onImport={onImport} />)
    const file = new File(['title,description\n,Missing title'], 'sections.csv', { type: 'text/csv' })

    await user.upload(container.querySelector('input[type="file"]'), file)
    expect(await screen.findByText(/Missing title/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import valid rows' })).toBeDisabled()
    expect(onImport).not.toHaveBeenCalled()
  })
})
