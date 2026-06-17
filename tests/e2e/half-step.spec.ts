import { test, expect, type Page } from '@playwright/test'

// Logging a tincture in half-milligram steps and seeing it persist with the mg unit.

const PASSWORD = 'password-123'

async function createVault(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#confirm').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create vault' }).click()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
}

test('logs a tincture in 0.5 mg steps and shows mg in the journal', async ({ page }) => {
  await createVault(page)

  // Pick Tincture — the unit is now mg (was drops).
  await page.getByRole('button', { name: 'Tincture' }).click()
  await expect(page.getByText('mg')).toBeVisible()

  // The + control steps the amount by 0.5: 1 → 1.5.
  await page.locator('button:has(svg.lucide-plus)').click()
  await expect(page.getByText('1.5')).toBeVisible()

  await page.getByRole('button', { name: 'Log' }).click()

  // The logged entry appears in the journal as "1.5 mg".
  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByText('1.5 mg')).toBeVisible()
})
