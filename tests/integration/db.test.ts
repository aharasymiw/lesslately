import { describe, it, expect, beforeEach } from 'vite-plus/test'
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
import { generateMasterKey, encrypt } from '@/lib/crypto'
import { AppSettingsSchema } from '@/lib/schemas'
import type { AuthPrefs, EncryptedRecord, VaultMeta } from '@/types'

// Install all fake-indexeddb globals so idb library can find them, then reset
// the db module cache so each test opens a fresh IndexedDB instance.
beforeEach(async () => {
  const newFactory = new IDBFactory()
  // @ts-expect-error — readonly in lib.dom.d.ts but writable via setup.ts defineProperty
  globalThis.indexedDB = newFactory
  // Ensure idb library's global checks (e.g. `if (IDBRequest)`) resolve to fake impls
  globalThis.IDBFactory = IDBFactory as unknown as typeof globalThis.IDBFactory
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

  const { resetDbForTesting } = await import('@/lib/db')
  resetDbForTesting()
})

// Write a raw object straight into the meta store under the vault key, bypassing
// saveVaultMeta's schema validation — used to simulate a stored legacy/foreign shape.
async function putRawMeta(meta: unknown) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('tracker-vault', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('meta')
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite')
    tx.objectStore('meta').put(meta, 'vault')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

describe('db - vault meta', () => {
  it('saves and retrieves vault meta', async () => {
    const { saveVaultMeta, getVaultMeta } = await import('@/lib/db')

    const meta = {
      version: 3,
      keySlots: [
        {
          id: 'password-slot',
          type: 'password',
          passwordSalt: 'aabbccdd'.repeat(8), // 64 hex chars
          encryptedMasterKey: 'base64data==',
          masterKeyIV: 'iv==',
        },
      ],
      verifyIV: 'verifyiv==',
      verifyCiphertext: 'verifyciphertext==',
      createdAt: new Date().toISOString(),
    } satisfies VaultMeta

    await saveVaultMeta(meta)
    const retrieved = await getVaultMeta()
    expect(retrieved).toEqual(meta)
  })

  it('returns undefined for a legacy pre-v3 meta shape (routes to onboarding)', async () => {
    const { getVaultMeta } = await import('@/lib/db')

    // Old v1 top-level shape (pre key-slots). With the migration shims removed,
    // a strict v3 parse rejects it and the app falls back to onboarding.
    await putRawMeta({
      version: 1,
      passwordSalt: 'aabbccdd'.repeat(8),
      encryptedMasterKey: 'base64data==',
      masterKeyIV: 'iv==',
      verifyIV: 'verifyiv==',
      verifyCiphertext: 'verifyciphertext==',
      createdAt: new Date().toISOString(),
    })

    expect(await getVaultMeta()).toBeUndefined()
  })

  it('returns undefined for a v3 meta carrying a non-password key slot', async () => {
    const { getVaultMeta } = await import('@/lib/db')

    // A v3 meta with a stray passkey slot no longer round-trips through a
    // normalization step; the strict parse rejects the whole meta.
    await putRawMeta({
      version: 3,
      keySlots: [
        {
          id: 'password-slot',
          type: 'password',
          passwordSalt: 'aabbccdd'.repeat(8),
          encryptedMasterKey: 'base64data==',
          masterKeyIV: 'iv==',
        },
        {
          id: 'passkey-slot',
          type: 'passkey',
          credentialId: 'credential-id',
          encryptedMasterKey: 'blob-data==',
          masterKeyIV: 'blob-iv==',
          label: 'Fingerprint / Face ID',
        },
      ],
      verifyIV: 'verifyiv==',
      verifyCiphertext: 'verifyciphertext==',
      createdAt: new Date().toISOString(),
    })

    expect(await getVaultMeta()).toBeUndefined()
  })

  it('returns undefined when no vault exists', async () => {
    const { getVaultMeta } = await import('@/lib/db')
    const result = await getVaultMeta()
    expect(result).toBeUndefined()
  })
})

describe('db - auth prefs', () => {
  it('returns defaults when no prefs exist', async () => {
    const { getAuthPrefs } = await import('@/lib/db')

    const prefs = await getAuthPrefs()
    expect(prefs).toEqual({
      stayLoggedIn: false,
    } satisfies AuthPrefs)
  })

  it('saves and retrieves auth prefs', async () => {
    const { saveAuthPrefs, getAuthPrefs } = await import('@/lib/db')

    const saved = await saveAuthPrefs({
      stayLoggedIn: true,
    })

    expect(saved).toEqual({
      stayLoggedIn: true,
    })

    const retrieved = await getAuthPrefs()
    expect(retrieved).toEqual(saved)
  })
})

describe('db - app settings schema', () => {
  it('strips stayLoggedIn from encrypted app settings', () => {
    const parsed = AppSettingsSchema.parse({
      theme: 'dark',
      autoLockMinutes: 10,
      stayLoggedIn: true,
    })

    expect(parsed).toEqual({
      theme: 'dark',
      autoLockMinutes: 10,
    })
    expect('stayLoggedIn' in parsed).toBe(false)
  })
})

describe('db - encrypted CRUD', () => {
  it('round-trips an encrypted record', async () => {
    const { putEncrypted, getEncrypted } = await import('@/lib/db')

    const key = await generateMasterKey()
    const data = JSON.stringify({ id: 'test-1', value: 'hello' })
    const { iv, ciphertext } = await encrypt(data, key)

    const record: EncryptedRecord = {
      id: 'test-1',
      iv,
      ciphertext,
      updatedAt: new Date().toISOString(),
    }

    await putEncrypted('entries', record)
    const retrieved = await getEncrypted('entries', 'test-1')

    expect(retrieved).toEqual(record)
  })

  it('returns all records', async () => {
    const { putEncrypted, getAllEncrypted } = await import('@/lib/db')

    const records: EncryptedRecord[] = ['a', 'b', 'c'].map((id) => ({
      id,
      iv: 'iv==',
      ciphertext: 'data==',
      updatedAt: new Date().toISOString(),
    }))

    for (const r of records) await putEncrypted('entries', r)
    const all = await getAllEncrypted('entries')
    expect(all.length).toBeGreaterThanOrEqual(3)
    for (const r of records) expect(all.find((x) => x.id === r.id)).toBeDefined()
  })

  it('deletes a record', async () => {
    const { putEncrypted, getEncrypted, deleteEncrypted } = await import('@/lib/db')

    const record: EncryptedRecord = {
      id: 'to-delete',
      iv: 'iv==',
      ciphertext: 'data==',
      updatedAt: new Date().toISOString(),
    }

    await putEncrypted('entries', record)
    await deleteEncrypted('entries', 'to-delete')
    const result = await getEncrypted('entries', 'to-delete')
    expect(result).toBeUndefined()
  })
})
