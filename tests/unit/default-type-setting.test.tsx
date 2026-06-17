import { describe, it, expect, afterEach, vi } from 'vite-plus/test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DefaultTypeSetting } from '@/components/settings/DefaultTypeSetting'
import { DataContext, type DataContextValue } from '@/hooks/useData'
import type { AppSettings, ConsumptionType } from '@/types'

function settings(defaultEntryType?: ConsumptionType): AppSettings {
  return { theme: 'system', autoLockMinutes: 5, ...(defaultEntryType ? { defaultEntryType } : {}) }
}

function makeCtx(over: Partial<DataContextValue> = {}): DataContextValue {
  return {
    entries: [],
    addEntry: vi.fn() as DataContextValue['addEntry'],
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

function renderSetting(ctx: DataContextValue) {
  return render(
    <DataContext.Provider value={ctx}>
      <DefaultTypeSetting />
    </DataContext.Provider>
  )
}

afterEach(cleanup)

describe('DefaultTypeSetting', () => {
  it('renders a non-interactive busy placeholder until settings are ready', () => {
    const saveSettings = vi.fn()
    renderSetting(
      makeCtx({
        settingsReady: false,
        saveSettings: saveSettings as DataContextValue['saveSettings'],
      })
    )
    // No tappable type tiles exist, so a pre-load tap can never persist a default
    // on top of DEFAULT_SETTINGS (which would clobber theme/auto-lock).
    expect(screen.queryByRole('button', { name: 'Flower' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Loading default type')
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('shows an honest "no default set" state with no tile pressed', () => {
    renderSetting(makeCtx({ settings: settings() }))
    expect(screen.getByText(/No default set/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()
  })

  it('reflects the saved default with a confirming helper line', () => {
    renderSetting(makeCtx({ settings: settings('vape') }))
    expect(screen.getByRole('button', { name: 'Vape' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Default: Vape/)).toBeInTheDocument()
  })

  it('persists the picked type via saveSettings', () => {
    const saveSettings = vi.fn().mockResolvedValue(undefined)
    renderSetting(makeCtx({ saveSettings: saveSettings as DataContextValue['saveSettings'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Edible' }))
    expect(saveSettings).toHaveBeenCalledWith({ defaultEntryType: 'edible' })
  })
})
