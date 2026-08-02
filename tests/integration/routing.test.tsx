import { describe, it, expect, afterEach, vi } from 'vite-plus/test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { lazy, Suspense } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AuthContext, type AuthContextValue } from '@/hooks/useAuth'
import { DataContext, type DataContextValue } from '@/hooks/useData'
import LogPage from '@/pages/LogPage'
import JournalPage from '@/pages/JournalPage'
import GoalsPage from '@/pages/GoalsPage'
import SettingsPage from '@/pages/SettingsPage'
import type { AppSettings } from '@/types'

// Mirrors App's route tree (including the lazy Insights chunk) with mocked
// auth/data providers, so react-router regressions — NavLink active state,
// the `end` prop on '/', Outlet layout routes, lazy route resolution — are
// caught below the e2e layer.

const InsightsPage = lazy(() => import('@/pages/InsightsPage'))

const settings: AppSettings = { theme: 'system', autoLockMinutes: 5 }

function authCtx(): AuthContextValue {
  return {
    vaultState: 'unlocked',
    unlockWithPassword: vi.fn().mockResolvedValue(true),
    lock: vi.fn(),
    createVaultWithPassword: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(true),
    masterKey: null,
    setAutoLockMinutes: vi.fn(),
    stayLoggedIn: false,
    setStayLoggedIn: vi.fn().mockResolvedValue(undefined),
  }
}

function dataCtx(): DataContextValue {
  return {
    entries: [],
    addEntry: vi.fn() as DataContextValue['addEntry'],
    updateEntry: vi.fn() as DataContextValue['updateEntry'],
    deleteEntry: vi.fn() as DataContextValue['deleteEntry'],
    goals: [],
    saveGoal: vi.fn() as DataContextValue['saveGoal'],
    deleteGoal: vi.fn() as DataContextValue['deleteGoal'],
    settings,
    saveSettings: vi.fn().mockResolvedValue(undefined),
    importBackup: vi.fn() as DataContextValue['importBackup'],
    isLoading: false,
    settingsReady: true,
  }
}

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={authCtx()}>
        <DataContext.Provider value={dataCtx()}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<LogPage />} />
              <Route path="/journal" element={<JournalPage />} />
              <Route
                path="/insights"
                element={
                  <Suspense fallback={<div>Loading…</div>}>
                    <InsightsPage />
                  </Suspense>
                }
              />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </DataContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const pageTitle = () => screen.getByRole('heading', { level: 1 }).textContent
const navLink = (name: string) => screen.getByRole('link', { name })

afterEach(cleanup)

describe('app routing (react-router)', () => {
  it('renders the Log page at / with only the Log tab active', () => {
    renderApp()
    expect(pageTitle()).toBe('Log')
    expect(navLink('Log')).toHaveAttribute('aria-current', 'page')
    expect(navLink('Journal')).not.toHaveAttribute('aria-current')
  })

  it('bottom-nav navigation swaps the page and the active tab', () => {
    renderApp()
    fireEvent.click(navLink('Journal'))
    expect(pageTitle()).toBe('Journal')
    expect(screen.getByText('Nothing logged yet')).toBeInTheDocument()
    expect(navLink('Journal')).toHaveAttribute('aria-current', 'page')
    // The `end` prop on '/' must keep Log inactive on sibling routes.
    expect(navLink('Log')).not.toHaveAttribute('aria-current')
  })

  it('resolves the lazy Insights route through Suspense', async () => {
    renderApp()
    fireEvent.click(navLink('Insights'))
    expect(await screen.findByText('No data yet')).toBeInTheDocument()
    expect(pageTitle()).toBe('Insights')
  })

  it("the header's Settings button navigates as a Link", () => {
    renderApp()
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))
    expect(pageTitle()).toBe('Settings')
  })

  it('renders a deep link directly on first entry', () => {
    renderApp('/goals')
    expect(pageTitle()).toBe('Goals')
  })
})
