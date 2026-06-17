import { describe, it, expect, afterEach, vi } from 'vite-plus/test'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LogPage from '@/pages/LogPage'
import { DataContext, type DataContextValue } from '@/hooks/useData'
import type { AppSettings, ConsumptionType } from '@/types'

// LogPage's behavior depends on the async-resolving settings from DataContext.
// Rather than fight the real provider's load timing, we drive LogPage with a
// controlled DataContext value so each settings/settingsReady state is exact and
// deterministic. (The real encrypt/IndexedDB path is covered by the integration
// and backup tests.)

function settings(defaultEntryType?: ConsumptionType): AppSettings {
  return { theme: 'system', autoLockMinutes: 5, ...(defaultEntryType ? { defaultEntryType } : {}) }
}

function makeCtx(over: Partial<DataContextValue> = {}): DataContextValue {
  return {
    entries: [],
    addEntry: vi.fn().mockResolvedValue(undefined) as DataContextValue['addEntry'],
    updateEntry: vi.fn() as DataContextValue['updateEntry'],
    deleteEntry: vi.fn() as DataContextValue['deleteEntry'],
    goals: [],
    saveGoal: vi.fn() as DataContextValue['saveGoal'],
    deleteGoal: vi.fn() as DataContextValue['deleteGoal'],
    settings: settings(),
    saveSettings: vi.fn().mockResolvedValue(undefined) as DataContextValue['saveSettings'],
    importBackup: vi.fn() as DataContextValue['importBackup'],
    isLoading: false,
    settingsReady: true,
    ...over,
  }
}

function renderLog(ctx: DataContextValue) {
  const ui = (c: DataContextValue) => (
    <DataContext.Provider value={c}>
      <LogPage />
    </DataContext.Provider>
  )
  const utils = render(ui(ctx))
  return { ...utils, rerenderWith: (c: DataContextValue) => utils.rerender(ui(c)) }
}

const tile = (name: string) => screen.getByRole('button', { name })

afterEach(cleanup)

describe('LogPage default consumption type', () => {
  it('pre-selects the saved default type', () => {
    renderLog(makeCtx({ settings: settings('vape') }))
    expect(tile('Vape')).toHaveAttribute('aria-pressed', 'true')
    expect(tile('Flower')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a perceptible loading placeholder (no pre-selection) until settings resolve', () => {
    renderLog(makeCtx({ settingsReady: false, settings: settings('vape') }))
    // No type tiles, and crucially nothing is pre-selected during the load window
    // (this is the no-flash guarantee — a checked Flower must never appear first).
    expect(screen.queryByRole('button', { name: 'Vape' })).toBeNull()
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()
    // The region is announced as busy with a status cue, not silent.
    expect(screen.getByText('Type').closest('section')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading consumption type')
  })

  it('snaps the pristine type to the default when it resolves after mount', () => {
    const { rerenderWith } = renderLog(makeCtx({ settings: settings() })) // no default → flower
    expect(tile('Flower')).toHaveAttribute('aria-pressed', 'true')
    rerenderWith(makeCtx({ settings: settings('vape') }))
    expect(tile('Vape')).toHaveAttribute('aria-pressed', 'true')
    expect(tile('Flower')).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not override a type the user picked before the default resolved (type path)', () => {
    const { rerenderWith } = renderLog(makeCtx({ settings: settings() }))
    fireEvent.click(tile('Edible'))
    expect(tile('Edible')).toHaveAttribute('aria-pressed', 'true')
    // Default resolves to vape afterwards — the user's pick must win.
    rerenderWith(makeCtx({ settings: settings('vape') }))
    expect(tile('Edible')).toHaveAttribute('aria-pressed', 'true')
    expect(tile('Vape')).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not override the type once any field is touched (non-type path: note toggle)', () => {
    const { rerenderWith } = renderLog(makeCtx({ settings: settings() }))
    // Opening the note marks the form touched without touching the type.
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    expect(screen.getByPlaceholderText(/Add a note/)).toBeInTheDocument()
    rerenderWith(makeCtx({ settings: settings('vape') }))
    // Late default must not clobber an in-progress entry.
    expect(tile('Flower')).toHaveAttribute('aria-pressed', 'true')
    expect(tile('Vape')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByPlaceholderText(/Add a note/)).toBeInTheDocument()
  })

  it('logs the selected type and resets to the saved default afterwards', async () => {
    const addEntry = vi.fn().mockResolvedValue(undefined)
    renderLog(
      makeCtx({ addEntry: addEntry as DataContextValue['addEntry'], settings: settings('vape') })
    )
    // Move away from the default, then log.
    fireEvent.click(tile('Edible'))
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(1))
    expect(addEntry.mock.calls[0][0]).toMatchObject({ type: 'edible', unit: 'mg' })
    await screen.findByText('Logged!')
    // LogConfirm auto-dismisses (~1.5s) → form resets to the saved default, not flower.
    await waitFor(() => expect(tile('Vape')).toHaveAttribute('aria-pressed', 'true'), {
      timeout: 2500,
    })
    expect(tile('Edible')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows mg as the unit when tincture is selected', () => {
    renderLog(makeCtx({ settings: settings() })) // flower default → hits
    expect(screen.getByText('hits')).toBeInTheDocument()
    fireEvent.click(tile('Tincture'))
    expect(screen.getByText('mg')).toBeInTheDocument()
    expect(screen.queryByText('drops')).toBeNull()
  })
})
