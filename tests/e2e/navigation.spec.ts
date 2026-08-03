import { test, expect, type Page } from '@playwright/test'

// Cross-page navigation smoke in a real browser: one logged entry flows
// through Journal and Insights, every tab renders, the lazy Insights chunk
// actually loads, and a deep link survives a reload + unlock. This is the
// canary for dependency updates (router, react, vite chunking, date-fns).

const PASSWORD = 'password-123'

async function createVault(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#confirm').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create vault' }).click()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
}

test('full page sweep with one logged entry', async ({ page }) => {
  await createVault(page)

  // Log a flower entry at the defaults.
  await page.getByRole('button', { name: 'Log' }).click()
  await expect(page.getByText('Logged!')).toBeVisible()

  // Journal groups it under Today with the amount + unit.
  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page).toHaveURL(/\/journal$/)
  await expect(page.locator('h1')).toHaveText('Journal')
  await expect(page.getByText('Today')).toBeVisible()
  await expect(page.getByText('1 hits')).toBeVisible()

  // Insights is a lazy chunk — it must load and render the charts.
  await page.getByRole('link', { name: 'Insights' }).click()
  await expect(page).toHaveURL(/\/insights$/)
  await expect(page.getByText('Day streak')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Daily usage' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Daily usage bar chart/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Solo vs Social' })).toBeVisible()

  // Goals renders.
  await page.getByRole('link', { name: 'Goals' }).click()
  await expect(page).toHaveURL(/\/goals$/)
  await expect(page.locator('h1')).toHaveText('Goals')

  // Settings via the header button.
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.locator('h1')).toHaveText('Settings')

  // Deep link survives reload: unlock lands back on /settings, not /.
  await page.reload()
  await expect(page.getByText('Enter your password to continue')).toBeVisible()
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Unlock with password' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.locator('h1')).toHaveText('Settings')
})
