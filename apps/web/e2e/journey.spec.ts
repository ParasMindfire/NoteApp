// FR-E2E-2: coverage assertion — run `pnpm coverage:e2e` after this spec to verify all FRs are tagged.
import { test, expect } from '@playwright/test'

test('E2E-S1..S11: full user journey', async ({ page }) => {
  const email = `test-${Date.now()}@example.com`
  const password = 'Password123'

  // Clipboard mock — spec.md Decision 4
  // Must be called before the first page.goto() so it persists across all SPA navigations.
  await page.addInitScript(() => {
    let _clip = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          _clip = text
          return Promise.resolve()
        },
      },
      configurable: true,
    })
    Object.defineProperty(window, '__clipboardData', {
      get: () => _clip,
      configurable: true,
    })
  })

  await test.step('E2E-S1: Register and land on notes', async () => {
    // Validates: FR-E2E-1 step 1, FR-AUTH-1, FR-AUTH-2, FR-UI-AUTH-4, FR-UI-AUTH-2
    await page.goto('/register')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.waitForURL('**/notes', { timeout: 15_000 })
    await expect(page.getByText('No notes yet')).toBeVisible({ timeout: 10_000 })
  })

  await test.step('E2E-S2: Navigate to note creation', async () => {
    // Validates: FR-E2E-1 step 2, FR-UI-NOTES-4, FR-UI-EDITOR-1
    await page.getByRole('link', { name: 'Create your first note' }).click()
    await page.waitForURL('**/notes/new', { timeout: 5_000 })
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 5_000 })
  })

  await test.step('E2E-S3: Type note content and autosave', async () => {
    // Validates: FR-E2E-1 step 3, FR-UI-EDITOR-1, FR-UI-EDITOR-2, FR-UI-EDITOR-3, FR-NOTE-1, FR-NOTE-3
    await page.getByLabel('Note title').fill('E2E Note')
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('This is the original body content.')
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
    await expect(page).not.toHaveURL('**/notes/new')
  })

  await test.step('E2E-S4: Add inline tag', async () => {
    // Validates: FR-E2E-1 step 4, FR-UI-EDITOR-5, FR-TAG-2
    await page.getByRole('button', { name: 'Add tag' }).click()
    await expect(page.getByPlaceholder('Search or create tag…')).toBeVisible({ timeout: 3_000 })
    await page.getByPlaceholder('Search or create tag…').fill('e2e-tag')
    await page.getByPlaceholder('Search or create tag…').press('Enter')
    await expect(page.getByTestId('tag-combobox').getByText('e2e-tag')).toBeVisible({
      timeout: 5_000,
    })
    // Wait for the tag change to autosave before navigating away
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  await test.step('E2E-S5: Note appears in list with tag', async () => {
    // Validates: FR-E2E-1 step 5, FR-UI-NOTES-1, FR-UI-NOTES-3, FR-NOTE-5
    await page.goto('/notes')
    await expect(page.getByRole('link', { name: /E2E Note/ })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('e2e-tag')).toBeVisible()
  })

  await test.step('E2E-S6: Search finds and highlights the note', async () => {
    // Validates: FR-E2E-1 step 6, FR-UI-SEARCH-1, FR-UI-SEARCH-2, FR-SEARCH-1, FR-SEARCH-2
    await page.getByRole('link', { name: 'Search' }).click()
    await page.getByLabel('Search notes').fill('E2E Note')
    await expect(page.locator('mark').first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: /E2E Note/ }).first().click()
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 5_000 })
  })

  await test.step('E2E-S7: Generate and copy share link', async () => {
    // Validates: FR-E2E-1 step 7, FR-UI-SHARE-1, FR-UI-SHARE-3, FR-SHARE-1
    await page.getByRole('button', { name: 'Share note' }).click()
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 7)
    const expiryStr = expiry.toISOString().split('T')[0]!
    await page.locator('input[type="date"]').fill(expiryStr)
    await page.getByRole('button', { name: 'Generate link' }).click()
    await expect(page.getByText('Link copied to clipboard')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('share-link-card').first()).toBeVisible()
    const clipData = await page.evaluate(
      () => (window as unknown as Record<string, string>).__clipboardData,
    )
    expect(clipData).toContain('/public/shares/')
  })

  await test.step('E2E-S8: Revoke share link', async () => {
    // Validates: FR-E2E-1 step 8, FR-UI-SHARE-4, FR-SHARE-2
    await page.getByRole('button', { name: /Revoke share link/ }).first().click()
    await page.getByRole('button', { name: 'Confirm revoke' }).click()
    await expect(page.getByText('Revoked')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('share-link-card').first()).toHaveClass(/opacity-50/)
    await page.keyboard.press('Escape')
  })

  await test.step('E2E-S9: Edit note to create version 2', async () => {
    // Validates: FR-E2E-1 step 9, FR-UI-EDITOR-3, FR-NOTE-3, FR-VER-1
    await page.locator('.ProseMirror').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' updated')
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Version history' }).click()
    // List is newest-first; two items means version 2 exists
    await expect(page.getByTestId('version-list-item').nth(1)).toBeVisible({ timeout: 5_000 })
  })

  await test.step('E2E-S10: View and restore an older version', async () => {
    // Validates: FR-E2E-1 step 10, FR-UI-VER-1, FR-UI-VER-2, FR-UI-VER-3, FR-UI-VER-4, FR-UI-VER-5, FR-VER-2, FR-VER-3, FR-VER-4
    // List is newest-first; .last() is version 1 (the original)
    await page.getByTestId('version-list-item').last().click()
    await expect(page.getByTestId('version-preview-pane')).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Restore this version' }).click()
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText('Restored version 1')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.ProseMirror')).toBeVisible()
  })

  await test.step('E2E-S11: Logout redirects to /login', async () => {
    // Validates: FR-E2E-1 step 11, FR-UI-AUTH-6, FR-AUTH-4
    await page.getByRole('button', { name: 'Logout' }).click()
    await page.waitForURL('**/login', { timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    // Protected route also redirects unauthenticated users
    await page.goto('/notes')
    await expect(page).toHaveURL(/login/)
  })
})
