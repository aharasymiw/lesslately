import { openDB, type IDBPDatabase } from 'idb'
import type { AuthPrefs, EncryptedRecord, VaultMeta } from '@/types'
import { AuthPrefsSchema, VaultMetaSchema } from '@/lib/schemas'

const DB_NAME = 'lesslately-vault'
const DB_VERSION = 1
const VAULT_META_KEY = 'vault'
const SESSION_KEY = 'session-key'
const AUTH_PREFS_KEY = 'auth-prefs'

const DEFAULT_AUTH_PREFS: AuthPrefs = {
  stayLoggedIn: false,
}

let dbPromise: Promise<IDBPDatabase> | null = null

// Drops the cached connection and closes it. IndexedDB will not delete a
// database while any connection to it is open, so every delete path has to go
// through here first.
function closeDB(): Promise<void> {
  const open = dbPromise
  dbPromise = null
  if (!open) return Promise.resolve()
  // A connection that never opened has nothing to close.
  return open.then(
    (db) => db.close(),
    () => undefined
  )
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      // Another tab is clearing (or upgrading) the vault and this connection is
      // what's holding it up. Let go so their delete can finish.
      blocking() {
        void closeDB()
      },
      upgrade(db) {
        // Unencrypted meta store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta')
        }
        // Encrypted stores
        if (!db.objectStoreNames.contains('entries')) {
          const entries = db.createObjectStore('entries', { keyPath: 'id' })
          entries.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// Vault meta is stored as the current schema (version 3, password key slots
// only) and read back with a single strict parse. Anything that does not
// validate — a legacy pre-v3 shape, or a v3 meta carrying a non-password key
// slot — returns undefined, which routes the app to onboarding (restore from
// backup). The historical v1/v2 migration shims and the passkey-slot
// normalization were removed once the sole vault was confirmed clean v3.
export async function getVaultMeta(): Promise<VaultMeta | undefined> {
  const db = await getDB()
  const raw = await db.get('meta', VAULT_META_KEY)
  const parsed = VaultMetaSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

export async function saveVaultMeta(meta: VaultMeta): Promise<void> {
  const db = await getDB()
  const parsed = VaultMetaSchema.parse(meta)
  await db.put('meta', parsed, VAULT_META_KEY)
}

export async function getAuthPrefs(): Promise<AuthPrefs> {
  const db = await getDB()
  const raw = await db.get('meta', AUTH_PREFS_KEY)
  const parsed = AuthPrefsSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_AUTH_PREFS
}

export async function saveAuthPrefs(updates: Partial<AuthPrefs>): Promise<AuthPrefs> {
  const db = await getDB()
  const current = await getAuthPrefs()
  const parsed = AuthPrefsSchema.parse({ ...current, ...updates })
  await db.put('meta', parsed, AUTH_PREFS_KEY)
  return parsed
}

// Everything the app persists outside IndexedDB — theme, "stay logged in", and
// the backup-reminder timestamps — is namespaced under this prefix. Clearing by
// prefix means a new setting is covered the day it's added.
const LOCAL_STORAGE_PREFIX = 'lesslately-'

function clearLocalSettings(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(LOCAL_STORAGE_PREFIX))
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // Ignore localStorage errors (e.g. private browsing)
  }
}

// Deletes the vault and every local setting. Dropping the cached promise is not
// enough — the underlying connection stays open, and IndexedDB answers a delete
// against an open connection with `blocked`, which fires no success and no
// error. That left the caller awaiting a promise that never settled while the
// delete sat queued until the next reload closed the connection for it.
export async function clearAllData(): Promise<void> {
  await closeDB()

  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('Could not delete the vault.'))
    // Another tab still holds the vault open and did not yield. IndexedDB has
    // no way to call the delete off — it stays queued and runs the moment that
    // connection goes away — so say what will actually happen rather than
    // implying the clear did not take.
    req.onblocked = () =>
      reject(
        new Error(
          'Another tab has Less Lately open. Your data will be cleared as soon as that tab is closed.'
        )
      )
  })

  clearLocalSettings()
}

// Session key persistence — used by AuthContext for "stay logged in"
// Stores the CryptoKey object directly (structured-cloneable, non-extractable).
// Verification is done against VaultMeta.verifyCiphertext, not a self-contained sentinel.
export async function saveSessionKey(key: CryptoKey): Promise<void> {
  const db = await getDB()
  await db.put('meta', key, SESSION_KEY)
}

export async function getSessionKey(): Promise<CryptoKey | undefined> {
  const db = await getDB()
  return db.get('meta', SESSION_KEY)
}

export async function clearSessionKey(): Promise<void> {
  const db = await getDB()
  await db.delete('meta', SESSION_KEY)
}

// Encrypted CRUD — used by DataContext
export async function putEncrypted(
  store: 'entries' | 'goals' | 'settings',
  record: EncryptedRecord
): Promise<void> {
  const db = await getDB()
  await db.put(store, record)
}

export async function getEncrypted(
  store: 'entries' | 'goals' | 'settings',
  id: string
): Promise<EncryptedRecord | undefined> {
  const db = await getDB()
  return db.get(store, id)
}

export async function getAllEncrypted(
  store: 'entries' | 'goals' | 'settings'
): Promise<EncryptedRecord[]> {
  const db = await getDB()
  return db.getAll(store)
}

export async function deleteEncrypted(
  store: 'entries' | 'goals' | 'settings',
  id: string
): Promise<void> {
  const db = await getDB()
  await db.delete(store, id)
}

export async function clearEncryptedStore(store: 'entries' | 'goals' | 'settings'): Promise<void> {
  const db = await getDB()
  await db.clear(store)
}

// Test-only: resets the cached DB promise so the next call opens a fresh connection
export function resetDbForTesting() {
  dbPromise = null
}
