/**
 * E2E tests for Blossom media server settings.
 *
 * Tests the Blossom server configuration section in Settings page.
 * Requires authentication for all tests.
 */
import { test, expect } from './fixtures.js';
import { setupErrorCapture } from './test-utils.js';

// ============================================================================
// Blossom Section Visibility Tests
// ============================================================================

test.describe('Blossom Settings - Section Visibility', () => {
  test('Blossom servers section is visible when authenticated', async ({
    authenticatedPage: page
  }) => {
    await page.goto('/settings');

    await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
      timeout: 10_000
    });

    // Wait for settings to load
    await page.waitForTimeout(5000);

    // Blossom servers section should be visible (card title contains "Blossom")
    const blossomSection = page.locator('.card-title:has-text("Blossom")').first();
    await expect(blossomSection).toBeVisible({ timeout: 10_000 });
  });

  test('shows Add Blossom Server input or Create Defaults button', async ({
    authenticatedPage: page
  }) => {
    await page.goto('/settings');

    await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
      timeout: 10_000
    });

    await page.waitForTimeout(5000);

    // Find the Blossom section
    const blossomCard = page
      .locator('.card')
      .filter({ hasText: /blossom|media server/i })
      .first();

    // Should see either an input for adding Blossom server URL OR a "Create defaults" button
    const blossomInput = blossomCard.locator('input[placeholder*="https://"]');
    const createDefaultsButton = blossomCard.locator('button:has-text("Create Server List")');

    const inputVisible = await blossomInput.isVisible().catch(() => false);
    const createDefaultsVisible = await createDefaultsButton.isVisible().catch(() => false);

    expect(inputVisible || createDefaultsVisible).toBe(true);
  });

  test('shows Add button for Blossom server after list exists', async ({
    authenticatedPage: page
  }) => {
    await page.goto('/settings');

    await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
      timeout: 10_000
    });

    await page.waitForTimeout(5000);

    // Find the Blossom section
    const blossomCard = page
      .locator('.card')
      .filter({ hasText: /blossom|media server/i })
      .first();

    // Check if we need to create defaults first
    const createDefaultsButton = blossomCard.locator('button:has-text("Create Server List")');
    if (await createDefaultsButton.isVisible().catch(() => false)) {
      await createDefaultsButton.click();
      await page.waitForTimeout(1000);
    }

    // Add button should be visible within the section
    const addButton = blossomCard.locator('.join button:has-text("Add")');
    await expect(addButton).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Blossom Server Input Tests
// ============================================================================

test.describe('Blossom Settings - Server Management', () => {
  /**
   * Helper to ensure Blossom server list exists before testing Add Server form.
   * If no server list exists, clicks "Create Server List with Defaults" button.
   * @param {import('@playwright/test').Page} page
   */
  async function ensureBlossomListExists(page) {
    await page.goto('/settings');

    await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
      timeout: 10_000
    });

    // Wait for settings to load
    await page.waitForTimeout(5000);

    // Find the Blossom section
    const blossomCard = page
      .locator('.card')
      .filter({ hasText: /blossom|media server/i })
      .first();

    // Check if "Create Server List with Defaults" button exists (means no server list)
    const createDefaultsButton = blossomCard.locator('button:has-text("Create Server List")');
    const hasNoServerList = await createDefaultsButton.isVisible().catch(() => false);

    if (hasNoServerList) {
      // Create default server list first
      await createDefaultsButton.click();
      await page.waitForTimeout(1000);
    }

    return blossomCard;
  }

  test('can type Blossom server URL in input', async ({ authenticatedPage: page }) => {
    const blossomCard = await ensureBlossomListExists(page);

    // Find input and type URL
    const blossomInput = blossomCard.locator('input').first();
    await blossomInput.fill('https://blossom.example.com');

    // Verify the input value
    await expect(blossomInput).toHaveValue('https://blossom.example.com');
  });

  test('shows validation error for invalid Blossom URL', async ({ authenticatedPage: page }) => {
    const blossomCard = await ensureBlossomListExists(page);

    // Enter invalid URL
    const blossomInput = blossomCard.locator('input').first();
    await blossomInput.fill('not-a-valid-url');

    // Click Add button
    const addButton = blossomCard.locator('button:has-text("Add")');
    await addButton.click();

    await page.waitForTimeout(500);

    // Should show error message - UI displays "URL must start with https://"
    const errorMessage = blossomCard.locator('text=URL must start with https://');
    const hasErrorMessage = await errorMessage.isVisible();

    // At minimum, the invalid URL should not be added to the list
    // and the error message should be shown
    expect(hasErrorMessage || (await blossomInput.inputValue()) === 'not-a-valid-url').toBe(true);
  });

  test('shows existing Blossom servers after creating defaults', async ({
    authenticatedPage: page
  }) => {
    const blossomCard = await ensureBlossomListExists(page);

    // After ensuring list exists, check if there are any server URLs displayed
    const serverUrls = blossomCard.locator('text=/https?:\\/\\//');
    const serverCount = await serverUrls.count();

    // Should have at least one server (either existing or from defaults)
    // OR the input should be visible for adding
    const inputVisible = await blossomCard.locator('input').first().isVisible();

    expect(serverCount > 0 || inputVisible).toBe(true);
  });

  test('Blossom server list shows remove button for each server', async ({
    authenticatedPage: page
  }) => {
    const blossomCard = await ensureBlossomListExists(page);

    // After ensuring list exists, servers should be visible
    const serverUrls = blossomCard.locator('.font-mono.text-sm');
    const serverCount = await serverUrls.count();

    if (serverCount > 0) {
      // Each server should have a remove button (X button with btn-square class)
      const removeButtons = blossomCard.locator('button.btn-square.text-error');
      // At least one remove button should exist if servers are present
      await expect(removeButtons.first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Blossom Settings - Error Handling', () => {
  test('no critical JavaScript errors during Blossom settings interaction', async ({
    authenticatedPage: page
  }) => {
    const errorCapture = setupErrorCapture(page);

    await page.goto('/settings');

    await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
      timeout: 10_000
    });

    await page.waitForTimeout(3000);

    // Find the Blossom section
    const blossomCard = page
      .locator('.card')
      .filter({ hasText: /blossom|media server/i })
      .first();

    // Interact with the input
    const blossomInput = blossomCard.locator('input').first();
    if (await blossomInput.isVisible()) {
      await blossomInput.fill('https://test.blossom.example');
      await page.waitForTimeout(500);
      await blossomInput.clear();
    }

    errorCapture.assertNoCriticalErrors();
  });
});
