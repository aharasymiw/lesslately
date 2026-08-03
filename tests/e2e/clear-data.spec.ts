import { test, expect, type Page } from '@playwright/test'

// "Clear all data" end to end, against browser IndexedDB and a real reload.
//
// The stuck-on-"Clearing…" hang itself is pinned down in the jsdom suites,
// where a blocked delete is deterministic; under automation Chrome sometimes
// tears the page's connection down on its own, so timing here is not a
// dependable signal. What this test does check deterministically is the
// outcome the user cares about: the vault and the locally-stored settings are
// really gone afterwards, and the app comes back usable.

const PASSWORD = 'password-123'

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
