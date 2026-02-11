/**
 * E2E tests for community creation (kind 10222).
 *
 * Tests the CreateCommunityModal flow including keypair selection,
 * community settings, and successful creation.
 */
import { test, expect } from './fixtures.js';
import { setupErrorCapture } from './test-utils.js';

/**
 * Navigate to the Communities tab on the discover page.
 * @param {import('@playwright/test').Page} page
 */
async function navigateToCommunitiesTab(page) {
  await page.goto('/discover');
  await page.waitForTimeout(2000);

  // Switch to Communities tab
  await page.locator('[data-testid="tab-communities"]').click();
  await page.waitForTimeout(2000);
}

/**
 * Open the CreateCommunityModal from the Communities tab.
 * @param {import('@playwright/test').Page} page
 */
async function openCreateCommunityModal(page) {
  const createButton = page.locator('button', { hasText: 'Create Community' });
  await expect(createButton).toBeVisible({ timeout: 10000 });
  await createButton.click();
  await page.waitForTimeout(500);
}

// ============================================================================
// Modal Access Tests
// ============================================================================

test.describe('Community Creation - Modal Access', () => {
  test('Create Community button not visible when not logged in', async ({ page }) => {
    await navigateToCommunitiesTab(page);

    // The "Create Community" button should NOT be visible for unauthenticated users
    const createButton = page.locator('button', { hasText: 'Create Community' });
    await expect(createButton).not.toBeVisible({ timeout: 3000 });
  });

  test('Create Community button visible when logged in', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);

    // The "Create Community" button should be visible for authenticated users
    const createButton = page.locator('button', { hasText: 'Create Community' });
    await expect(createButton).toBeVisible({ timeout: 10000 });
  });

  test('clicking Create Community button opens modal', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Modal should be visible (dialog element with heading)
    const modalHeading = page.getByRole('heading', { name: 'Create New Community' });
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Should show keypair selection options (step 0)
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await expect(useCurrentButton).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Step 0 - Keypair Selection Tests
// ============================================================================

test.describe('Community Creation - Keypair Selection', () => {
  test('step 0 shows two keypair options', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Should show "Use Current Keypair" option
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await expect(useCurrentButton).toBeVisible({ timeout: 5000 });

    // Should show "Create New Keypair" option
    const createNewButton = page.locator('button', { hasText: 'Create New Keypair' });
    await expect(createNewButton).toBeVisible({ timeout: 5000 });
  });

  test('selecting "Use Current Keypair" advances to step 1', async ({
    authenticatedPage: page
  }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Click "Use Current Keypair"
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    // Should now show community settings (step 1)
    // The relays section should be visible
    const relaysLabel = page.locator('text=Relays');
    await expect(relaysLabel).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Step 1 - Community Settings Tests
// ============================================================================

test.describe('Community Creation - Community Settings', () => {
  test('step 1 shows settings form fields', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Advance to step 1
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    // Should show relays section (label says "Community Relays")
    const relaysLabel = page.locator('text=Community Relays');
    await expect(relaysLabel).toBeVisible({ timeout: 5000 });

    // Should show content types section
    const contentTypesLabel = page.getByText('Content Types', { exact: true });
    await expect(contentTypesLabel).toBeVisible({ timeout: 5000 });
  });

  test('can toggle content types', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Advance to step 1
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    // Content types are displayed as buttons with checkboxes inside
    // Find the Calendar button and click it to toggle
    const calendarButton = page.locator('button', { hasText: 'Calendar' }).filter({
      has: page.locator('input[type="checkbox"]')
    });
    await expect(calendarButton).toBeVisible({ timeout: 5000 });

    // Get the checkbox inside the button
    const calendarCheckbox = calendarButton.locator('input[type="checkbox"]');
    const isChecked = await calendarCheckbox.isChecked();

    // Click the button to toggle
    await calendarButton.click();
    await page.waitForTimeout(300);

    // Verify it changed
    const newState = await calendarCheckbox.isChecked();
    expect(newState).toBe(!isChecked);
  });

  test('default relay is pre-populated', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Advance to step 1
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    // Default relay (wss://relay.edufeed.org) should be listed
    const defaultRelay = page.locator('text=wss://relay.edufeed.org');
    await expect(defaultRelay).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Creation Flow Tests
// ============================================================================

test.describe('Community Creation - Full Flow', () => {
  test('can advance to confirmation step', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Step 0: Select "Use Current Keypair"
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    // Step 1: Click Next to go to confirmation
    const nextButton = page.locator('.modal-box button', { hasText: 'Next' });
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();
    await page.waitForTimeout(500);

    // Should now show the Create Community button (confirmation step)
    const createButton = page.locator('.modal-box button', { hasText: 'Create Community' });
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('can complete community creation', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Step 0: Select "Use Current Keypair"
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    // Step 1: Click Next
    const nextButton = page.locator('.modal-box button', { hasText: 'Next' });
    await nextButton.click();
    await page.waitForTimeout(500);

    // Step 2: Click Create Community
    const createButton = page.locator('.modal-box button', { hasText: 'Create Community' });
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();

    // Wait for creation to complete and navigation
    // Should navigate to the community page (/c/[pubkey])
    await page.waitForURL(/\/c\//, { timeout: 15000 });

    // Should be on a community page
    expect(page.url()).toMatch(/\/c\//);
  });

  test('created community shows user as joined', async ({ authenticatedPage: page }) => {
    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Complete creation flow
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    const nextButton = page.locator('.modal-box button', { hasText: 'Next' });
    await nextButton.click();
    await page.waitForTimeout(500);

    const createButton = page.locator('.modal-box button', { hasText: 'Create Community' });
    await createButton.click();

    // Wait for navigation to community page
    await page.waitForURL(/\/c\//, { timeout: 15000 });

    // Should show "Joined" badge (user auto-joins their created community)
    const joinedBadge = page.locator('.badge-success', { hasText: 'Joined' }).first();
    await expect(joinedBadge).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Community Creation - Error Handling', () => {
  test('no critical JavaScript errors during modal interaction', async ({
    authenticatedPage: page
  }) => {
    const errorCapture = setupErrorCapture(page);

    await navigateToCommunitiesTab(page);
    await openCreateCommunityModal(page);

    // Interact with the modal
    const useCurrentButton = page.locator('button', { hasText: 'Use Current Keypair' });
    await useCurrentButton.click();
    await page.waitForTimeout(500);

    // Click back
    const backButton = page.locator('.modal-box button', { hasText: 'Back' });
    if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backButton.click();
      await page.waitForTimeout(500);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    errorCapture.assertNoCriticalErrors();
  });
});
