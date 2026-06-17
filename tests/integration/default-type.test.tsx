import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import {
  IDBFactory,
  IDBKeyRange,
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBIndex,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  IDBVersionChangeEvent,
} from 'fake-indexeddb'
import { AuthProvider } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { useAuth } from '@/hooks/useAuth'
import { useData } from '@/hooks/useData'
import { DefaultTypeSetting } from '@/components/settings/DefaultTypeSetting'

// Exercises the real saveSettings → AES-256-GCM → IndexedDB path for the new
// defaultEntryType preference, and the data-safety property that picking a
// default never clobbers unrelated saved settings.

function installIndexedDbGlobals() {
  // @ts-expect-error writable in runtime
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange as unknown as typeof globalThis.IDBKeyRange
  globalThis.IDBCursor = IDBCursor as unknown as typeof globalThis.IDBCursor
  globalThis.IDBCursorWithValue =
    IDBCursorWithValue as unknown as typeof globalThis.IDBCursorWithValue
  globalThis.IDBDatabase = IDBDatabase as unknown as typeof globalThis.IDBDatabase
  globalThis.IDBIndex = IDBIndex as unknown as typeof globalThis.IDBIndex
  globalThis.IDBObjectStore = IDBObjectStore as unknown as typeof globalThis.IDBObjectStore
  globalThis.IDBOpenDBRequest = IDBOpenDBRequest as unknown as typeof globalThis.IDBOpenDBRequest
  globalThis.IDBRequest = IDBRequest as unknown as typeof globalThis.IDBRequest
  globalThis.IDBTransaction = IDBTransaction as unknown as typeof globalThis.IDBTransaction
  globalThis.IDBVersionChangeEvent =
    IDBVersionChangeEvent as unknown as typeof globalThis.IDBVersionChangeEvent
}

function Inspector() {
  const { settings, settingsReady, saveSettings } = useData()
  return (
    <>
      <div data-testid="ready">{String(settingsReady)}</div>
      <div data-testid="default">{settings.defaultEntryType ?? 'none'}</div>
      <div data-testid="theme">{settings.theme}</div>
      <div data-testid="autolock">{settings.autoLockMinutes}</div>
      <button
        type="button"
        onClick={() => void saveSettings({ theme: 'dark', autoLockMinutes: 10 })}
      >
        set other prefs
      </button>
    </>
  )
}

function Harness() {
  const { vaultState, createVaultWithPassword, lock, unlockWithPassword } = useAuth()
  return (
    <div>
      <div data-testid="vault-state">{vaultState}</div>
      <button type="button" onClick={() => void createVaultWithPassword('password-123')}>
        create vault
      </button>
      <button type="button" onClick={() => lock()}>
        lock
      </button>
      <button type="button" onClick={() => void unlockWithPassword('password-123')}>
        unlock
      </button>
      <DefaultTypeSetting />
      <Inspector />
    </div>
  )
}

function mount() {
  return render(
    <AuthProvider>
      <DataProvider>
        <Harness />
      </DataProvider>
    </AuthProvider>
  )
}

async function createVault() {
  fireEvent.click(screen.getByText('create vault'))
  await waitFor(() => expect(screen.getByTestId('vault-state').textContent).toBe('unlocked'))
  await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))
}

beforeEach(async () => {
  installIndexedDbGlobals()
  localStorage.clear()
  sessionStorage.clear()
  const { resetDbForTesting } = await import('@/lib/db')
  resetDbForTesting()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('default consumption type (settings persistence)', () => {
  it('persists the chosen default through the real encrypted settings store', async () => {
    mount()
    await createVault()
    expect(screen.getByTestId('default').textContent).toBe('none')

    fireEvent.click(screen.getByRole('button', { name: 'Vape' }))
    await waitFor(() => expect(screen.getByTestId('default').textContent).toBe('vape'))
    expect(screen.getByRole('button', { name: 'Vape' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not clobber unrelated settings (theme/auto-lock) when a default is set', async () => {
    mount()
    await createVault()

    // Establish non-default theme + auto-lock first.
    fireEvent.click(screen.getByRole('button', { name: 'set other prefs' }))
    await waitFor(() => expect(screen.getByTestId('theme').textContent).toBe('dark'))
    expect(screen.getByTestId('autolock').textContent).toBe('10')

    // Picking a default must merge onto loaded settings, not DEFAULT_SETTINGS.
    fireEvent.click(screen.getByRole('button', { name: 'Edible' }))
    await waitFor(() => expect(screen.getByTestId('default').textContent).toBe('edible'))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('autolock').textContent).toBe('10')
  })

  it('restores the saved default after a lock/unlock cycle (real decrypt round-trip)', async () => {
    mount()
    await createVault()

    fireEvent.click(screen.getByRole('button', { name: 'Vape' }))
    await waitFor(() => expect(screen.getByTestId('default').textContent).toBe('vape'))

    // Lock: settings reset to defaults and the ready gate drops.
    fireEvent.click(screen.getByRole('button', { name: 'lock' }))
    await waitFor(() => expect(screen.getByTestId('vault-state').textContent).toBe('locked'))
    expect(screen.getByTestId('default').textContent).toBe('none')
    expect(screen.getByTestId('ready').textContent).toBe('false')

    // Unlock: loadAll decrypts the encrypted settings record and restores the default.
    fireEvent.click(screen.getByRole('button', { name: 'unlock' }))
    await waitFor(() => expect(screen.getByTestId('vault-state').textContent).toBe('unlocked'))
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))
    expect(screen.getByTestId('default').textContent).toBe('vape')
  })
})
