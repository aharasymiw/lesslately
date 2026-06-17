import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { EntryEditor } from '@/components/journal/EntryEditor'
import type { LogEntry } from '@/types'

// EntryEditor is the third consumer of TypeSelector (inside a Base UI Dialog).
// Guards that the aria-pressed accessibility change does not disturb the
// journal Edit dialog: selection is announced, and picking + saving still works.

function installDomStubs() {
  if (!globalThis.matchMedia) {
    // @ts-expect-error test stub
    globalThis.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })
  }
  if (!globalThis.ResizeObserver) {
    // @ts-expect-error test stub
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}

const entry: LogEntry = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  type: 'edible',
  amount: 10,
  unit: 'mg',
  socialContext: 'solo',
  timestamp: new Date('2026-06-05T14:30:00.000Z'),
  createdAt: new Date('2026-06-05T14:30:00.000Z'),
  updatedAt: new Date('2026-06-05T14:30:00.000Z'),
}

beforeEach(installDomStubs)
afterEach(cleanup)

describe('EntryEditor (TypeSelector consumer)', () => {
  it('announces the entry type as selected and saves a changed type', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<EntryEditor entry={entry} onSave={onSave} onClose={onClose} />)

    // Current type is announced via aria-pressed, not just CSS.
    expect(screen.getByRole('button', { name: 'Edible' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Flower' })).toHaveAttribute('aria-pressed', 'false')

    // Change type and save.
    fireEvent.click(screen.getByRole('button', { name: 'Flower' }))
    expect(screen.getByRole('button', { name: 'Flower' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toBe(entry.id)
    expect(onSave.mock.calls[0][1]).toMatchObject({ type: 'flower', unit: 'hits' })
  })
})
