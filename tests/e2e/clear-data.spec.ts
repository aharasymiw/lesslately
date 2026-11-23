import { test, expect, type Page } from '@playwright/test'

// "Clear all data" end to end, against browser IndexedDB and a real reload.
//
// Waiting on the app's own connection to block the delete is not a dependable
// signal under automation — Chrome sometimes tears it down unprompted, which
// lets the delete through even on the broken implementation. So the hang is
// provoked instead: the second test holds a connection the app cannot close,
// which blocks the delete every time.

const PASSWORD = 'password-123'

/**
 * Opens a connection the page keeps alive and never yields, standing in for a
 * second tab with the vault open. IndexedDB cannot delete a database while it
 * exists, so any delete attempted afterwards is deterministically blocked.
 */
function holdVaultOpen(page: Page) {
  return page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('lesslately-vault')
        // No `onversionchange` handler, so this connection ignores the request
        // to close, exactly like a tab sitting in the background.
        request.onsuccess = () => {
          ;(window as unknown as { heldConnection?: IDBDatabase }).heldConnection = request.result
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
  )
}

async function createVaultWithAnEntry(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#confirm').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create vault' }).click()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()

  await page.getByRole('button', { name: 'Log' }).click()
  await expect(page.getByText('Logged!')).toBeVisible()
}

test('clearing all data wipes the vault and returns to onboarding', async ({ page }) => {
  await createVaultWithAnEntry(page)

  // A theme choice is a setting the confirm dialog promises to delete, and it
  // lives in localStorage rather than the vault.
  await page.evaluate(() => localStorage.setItem('lesslately-theme', 'dark'))

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.locator('h1')).toHaveText('Settings')

  await page.getByRole('button', { name: /Clear all data/ }).click()
  await page.getByRole('button', { name: 'Clear everything' }).click()

  // The component reloads once the delete resolves, which drops the now
  // vault-less app back to onboarding.
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible({ timeout: 15_000 })

  // The database name comes back — the reloaded app opens a fresh, empty vault
  // on boot — so assert on the contents instead: no vault meta, no entries.
  const remaining = await page.evaluate(
    () =>
      new Promise<{ meta: unknown; entries: number }>((resolve, reject) => {
        const request = indexedDB.open('lesslately-vault')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['meta', 'entries'], 'readonly')
          const meta = tx.objectStore('meta').get('vault')
          const entries = tx.objectStore('entries').getAll()
          tx.oncomplete = () => {
            db.close()
            resolve({ meta: meta.result ?? null, entries: entries.result.length })
          }
          tx.onerror = () => reject(tx.error)
        }
      })
  )
  expect(remaining).toEqual({ meta: null, entries: 0 })

  // The theme the user had chosen is gone too — the dialog promises to delete
  // settings, and those live outside the vault.
  expect(await page.evaluate(() => localStorage.getItem('lesslately-theme'))).toBeNull()

  // A fresh vault can be created on top of the cleared state, and it is empty.
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#confirm').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create vault' }).click()
  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByText('Nothing logged yet')).toBeVisible()
})

test('a blocked delete reports itself instead of hanging on "Clearing…"', async ({ page }) => {
  await createVaultWithAnEntry(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.locator('h1')).toHaveText('Settings')

  await holdVaultOpen(page)

  await page.getByRole('button', { name: /Clear all data/ }).click()
  await page.getByRole('button', { name: 'Clear everything' }).click()

  // The regression: with no `onblocked` handler the promise never settled, so
  // the button sat here indefinitely and the user was told nothing.
  await expect(page.getByRole('button', { name: 'Clearing…' })).toHaveCount(0, { timeout: 10_000 })
  await expect(
    page.getByText(
      /Another tab has Less Lately open\. Your data will be cleared as soon as that tab is closed\./
    )
  ).toBeVisible()

  // The app itself is left in one piece — still unlocked, still on Settings.
  // The vault is not: the delete is queued and lands when the blocker closes,
  // which is what the message promises and what the next assertion proves.
  await expect(page.getByRole('button', { name: 'Clear everything' })).toBeEnabled()
  await expect(page).toHaveURL(/\/settings$/)

  // Release the blocking connection; the queued delete then runs on its own.
  await page.evaluate(() => {
    ;(window as unknown as { heldConnection?: IDBDatabase }).heldConnection?.close()
  })
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve, reject) => {
              const request = indexedDB.open('lesslately-vault')
              request.onerror = () => reject(request.error)
              request.onsuccess = () => {
                const db = request.result
                if (!db.objectStoreNames.contains('entries')) {
                  db.close()
                  return resolve(0)
                }
                const tx = db.transaction('entries', 'readonly')
                const all = tx.objectStore('entries').getAll()
                tx.oncomplete = () => {
                  db.close()
                  resolve(all.result.length)
                }
                tx.onerror = () => reject(tx.error)
              }
            })
        ),
      { timeout: 10_000 }
    )
    .toBe(0)
})
