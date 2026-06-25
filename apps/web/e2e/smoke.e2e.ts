import { test, expect } from '@playwright/test'

test('INFRA-S3: baseline smoke — NoteApp heading visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'NoteApp' })).toBeVisible()
})
