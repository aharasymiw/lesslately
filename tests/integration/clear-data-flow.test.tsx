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
import { DataExport } from '@/components/settings/DataExport'

// --- Test environment ----------------------------------------------------

function installIndexedDbGlobals() {
  const newFactory = new IDBFactory()
  // @ts-expect-error writable in runtime
  globalThis.indexedDB = newFactory
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

// Base UI's Dialog/Switch touch browser APIs jsdom omits.
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

/** jsdom has no navigation; capture the reload the component fires on success. */
function stubReload() {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  })
  return reload
}

// --- Harness -------------------------------------------------------------

function VaultHarness() {
  const { vaultState, createVaultWithPassword } = useAuth()
  return (
    <div>
      <div data-testid="vault-state">{vaultState}</div>
      <button type="button" onClick={() => void createVaultWithPassword('password-123')}>
        create vault
      </button>
      <DataExport />
    </div>
  )
}

function mount() {
  return render(
    <AuthProvider>
      <DataProvider>
        <VaultHarness />
      </DataProvider>
    </AuthProvider>
  )
}

async function createVault() {
  fireEvent.click(screen.getByText('create vault'))
  await waitFor(() => expect(screen.getByTestId('vault-state').textContent).toBe('unlocked'))
}

async function confirmClear() {
  fireEvent.click(screen.getByRole('button', { name: /Clear all data/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Clear everything' }))
}

beforeEach(async () => {
  installIndexedDbGlobals()
  installDomStubs()
  localStorage.clear()
  sessionStorage.clear()
  const { resetDbForTesting } = await import('@/lib/db')
  resetDbForTesting()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('clear all data (UI)', () => {
  it('completes and reloads instead of hanging on "Clearing…"', async () => {
    const reload = stubReload()
    mount()
    await createVault()

    await confirmClear()

    // The regression: the delete stayed blocked by the app's own open
    // connection, so the promise never settled and this reload never ran.
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 3000 })
  })

  it('wipes the vault and the locally-stored settings', async () => {
    stubReload()
    mount()
    await createVault()
    localStorage.setItem('lesslately-theme', 'dark')

    await confirmClear()

    await waitFor(async () => {
      const { getVaultMeta } = await import('@/lib/db')
      expect(await getVaultMeta()).toBeUndefined()
    })
    expect(localStorage.getItem('lesslately-theme')).toBeNull()
  })

  it('surfaces the reason and re-enables the button when the delete cannot proceed', async () => {
    const reload = stubReload()
    mount()
    await createVault()

    // Something outside the module holds the vault open, like a stale tab.
    const stubborn = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('lesslately-vault', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('meta')
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })

    try {
      await confirmClear()

      await screen.findByText(/Another tab has Less Lately open/, undefined, { timeout: 3000 })
      // Actionable, not a dead end: the button is live again and no reload ran.
      expect(screen.getByRole('button', { name: 'Clear everything' })).not.toBeDisabled()
      expect(reload).not.toHaveBeenCalled()
    } finally {
      stubborn.close()
    }
  })
})
