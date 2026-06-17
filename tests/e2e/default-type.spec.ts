import { test, expect, type Page } from '@playwright/test'

// The literal requirement: a chosen default mode of consumption persists and is
// pre-selected every time the user opens or refreshes the Log page.

const PASSWORD = 'password-123'

async function createVault(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#confirm').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create vault' }).click()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
}

test('default consumption type persists and pre-selects on the Log page across reload', async ({
  page,
}) => {
  await createVault(page)

  // Open Settings and keep the session across reloads.
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('switch').click() // "Stay logged in"

  // Choose Vape as the default mode of consumption.
  const settingsVape = page.getByRole('button', { name: 'Vape' })
  await settingsVape.click()
  await expect(settingsVape).toHaveAttribute('aria-pressed', 'true')

  // The Log page now opens on Vape, not the old hard-coded Flower.
  await page.getByRole('link', { name: 'Log' }).click()
  await expect(page.getByRole('button', { name: 'Vape' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Flower' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )

  // Refreshing the default page still pre-selects Vape (persisted, encrypted).
  await page.reload()
  await expect(page.getByRole('button', { name: 'Vape' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Flower' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
})
