/**
 * E2E tests for NIP-50 search on the Learning tab.
 *
 * Tests search functionality including text search, SKOS filters,
 * and search results display on the discover page Learning tab.
 *
 * Note: Full search flow testing depends on relay behavior (NIP-50 support).
 * These tests focus on UI element presence and basic functionality.
 */
import { test, expect } from './fixtures.js';
import { setupErrorCapture } from './test-utils.js';

/**
 * Navigate to discover page and switch to Learning tab.
 * @param {import('@playwright/test').Page} page
 */
async function navigateToLearningTab(page) {
  await page.goto('/discover');
  await page.waitForTimeout(2000);

  // Click the Learning tab using data-testid
  await page.locator('[data-testid="tab-learning"]').click();

  // Wait for learning tab to activate and content area to render
  await page.waitForTimeout(3000);
}

/**
 * Get the main search input element.
 * @param {import('@playwright/test').Page} page
 */
function getSearchInput(page) {
  // Use "Search content" aria-label to distinguish from SKOS dropdown search inputs
  return page.getByRole('textbox', { name: 'Search content' });
}

// ============================================================================
// Search Input Tests
// ============================================================================

test.describe('Learning Search - Search Input', () => {
  test('search input visible on Learning tab', async ({ page }) => {
    await navigateToLearningTab(page);

    // Search input should be visible
    const searchInput = getSearchInput(page);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('can type in search input', async ({ page }) => {
    await navigateToLearningTab(page);

    // Get search input and type a search term
    const searchInput = getSearchInput(page);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill('Mathematics');
    await page.waitForTimeout(500);

    // Verify the text was entered
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('Mathematics');
  });

  test('clear button appears and works when text is entered', async ({ page }) => {
    await navigateToLearningTab(page);

    const searchInput = getSearchInput(page);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type a search term
    await searchInput.fill('Physics');
    await page.waitForTimeout(500);

    // Clear button should appear
    const clearButton = page.locator('button', { hasText: '✕' });
    await expect(clearButton).toBeVisible({ timeout: 3000 });

    // Click clear button
    await clearButton.click();
    await page.waitForTimeout(500);

    // Search input should be empty
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('');
  });
});

// ============================================================================
// SKOS Filter Tests
// ============================================================================

test.describe('Learning Search - SKOS Filters', () => {
  test('Resource Type dropdown is visible on Learning tab', async ({ page }) => {
    await navigateToLearningTab(page);

    // SKOS dropdown label should be visible
    const resourceTypeLabel = page.locator('text=Resource Type');
    await expect(resourceTypeLabel).toBeVisible({ timeout: 10000 });

    // The "Select type..." button should be visible
    const selectButton = page.locator('button', { hasText: 'Select type...' });
    await expect(selectButton).toBeVisible({ timeout: 5000 });
  });

  test('Subject dropdown is visible on Learning tab', async ({ page }) => {
    await navigateToLearningTab(page);

    // Subject dropdown label should be visible (use exact match)
    const subjectLabel = page.getByText('Subject', { exact: true });
    await expect(subjectLabel).toBeVisible({ timeout: 10000 });

    // The "Select subject..." button should be visible
    const selectButton = page.locator('button', { hasText: 'Select subject...' });
    await expect(selectButton).toBeVisible({ timeout: 5000 });
  });

  test('Resource Type dropdown opens with options', async ({ page }) => {
    await navigateToLearningTab(page);

    // Click to open the dropdown
    const resourceTypeButton = page.locator('button', { hasText: 'Select type...' });
    await expect(resourceTypeButton).toBeVisible({ timeout: 10000 });
    await resourceTypeButton.click();
    await page.waitForTimeout(500);

    // Should show options (e.g., "Text", "Video", etc.)
    const textOption = page.locator('button', { hasText: 'Text' }).first();
    await expect(textOption).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Tab Navigation Tests
// ============================================================================

test.describe('Learning Search - Tab Navigation', () => {
  test('SKOS filters not visible on Events tab', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForTimeout(2000);

    // Switch to Events tab
    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(2000);

    // SKOS filter labels should NOT be visible on Events tab
    const resourceTypeLabel = page.locator('text=Resource Type');
    await expect(resourceTypeLabel).not.toBeVisible({ timeout: 3000 });
  });

  test('SKOS filters not visible on Communities tab', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForTimeout(2000);

    // Switch to Communities tab
    await page.locator('[data-testid="tab-communities"]').click();
    await page.waitForTimeout(2000);

    // SKOS filter labels should NOT be visible on Communities tab
    const resourceTypeLabel = page.locator('text=Resource Type');
    await expect(resourceTypeLabel).not.toBeVisible({ timeout: 3000 });
  });

  test('SKOS filters appear after switching to Learning tab', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForTimeout(2000);

    // Start on All tab, verify SKOS filters not visible
    let resourceTypeLabel = page.locator('text=Resource Type');
    await expect(resourceTypeLabel).not.toBeVisible({ timeout: 3000 });

    // Switch to Learning tab
    await page.locator('[data-testid="tab-learning"]').click();
    await page.waitForTimeout(2000);

    // SKOS filters SHOULD now be visible
    resourceTypeLabel = page.locator('text=Resource Type');
    await expect(resourceTypeLabel).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// Sort and Relay Filters Tests
// ============================================================================

test.describe('Learning Search - Common Filters', () => {
  test('Sort dropdown is visible on Learning tab', async ({ page }) => {
    await navigateToLearningTab(page);

    // Sort dropdown should be visible with "Newest First" selected
    const sortDropdown = page.getByRole('combobox', { name: /sort/i });
    await expect(sortDropdown).toBeVisible({ timeout: 10000 });
  });

  test('Relay filter dropdown is visible on Learning tab', async ({ page }) => {
    await navigateToLearningTab(page);

    // Relay filter should be visible
    const relayLabel = page.locator('text=Relay:');
    await expect(relayLabel).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Learning Search - Error Handling', () => {
  test('no critical JavaScript errors during page load', async ({ page }) => {
    const errorCapture = setupErrorCapture(page);

    await navigateToLearningTab(page);

    // Just verify page loaded without critical errors
    const searchInput = getSearchInput(page);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    errorCapture.assertNoCriticalErrors();
  });

  test('no critical JavaScript errors when typing in search', async ({ page }) => {
    const errorCapture = setupErrorCapture(page);

    await navigateToLearningTab(page);

    const searchInput = getSearchInput(page);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type and clear search
    await searchInput.fill('Economics');
    await page.waitForTimeout(1000);
    await searchInput.fill('');
    await page.waitForTimeout(500);

    errorCapture.assertNoCriticalErrors();
  });
});
