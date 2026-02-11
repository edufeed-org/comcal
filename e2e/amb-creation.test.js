/**
 * E2E tests for AMB (Educational Resource) creation flow.
 *
 * Tests the FAB, modal wizard UI, and step 1 form interaction.
 * All tests require authentication and use a test community.
 *
 * Note: Full creation flow testing is limited because SKOS dropdowns
 * require external vocabulary data that may not load in E2E environment.
 */
import { test, expect, openAMBCreationModal } from './fixtures.js';
import { setupErrorCapture } from './test-utils.js';
import { TEST_COMMUNITY } from './test-data.js';

// ============================================================================
// FAB and Modal UI Tests
// ============================================================================

test.describe('AMB Resource Creation - FAB and Modal UI', () => {
  test('FAB is visible on community Learning tab for authenticated user', async ({
    authenticatedPage: page
  }) => {
    // Navigate to community page
    await page.goto(`/c/${TEST_COMMUNITY.npub}`);
    await page.waitForTimeout(2000);

    // Wait for community sidebar to load
    await expect(page.locator('nav.menu').first()).toBeVisible({ timeout: 15000 });

    // Click on Learning tab using nav.menu button selector
    await page.locator('nav.menu button', { hasText: 'Learning' }).click();
    await page.waitForTimeout(2000);

    // FAB should be visible (use .first() since there's mobile and desktop FAB)
    await expect(page.locator('.fab').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking Create Learning Content opens wizard modal', async ({
    authenticatedPage: page
  }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Modal should be visible with wizard content
    await expect(page.locator('dialog[open]')).toBeVisible();

    // Should show Step 1 title input
    await expect(page.locator('#amb-title')).toBeVisible();

    // Should have navigation buttons (Next should be visible on step 1)
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
  });

  test('modal closes on close button click', async ({ authenticatedPage: page }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Modal should be visible
    await expect(page.locator('dialog[open]')).toBeVisible();

    // Click the close button (X button in modal header)
    await page.locator('dialog[open] button.btn-circle').first().click();

    // Modal should close
    await expect(page.locator('dialog[open]')).not.toBeVisible({ timeout: 3000 });
  });

  test('modal closes on Escape key', async ({ authenticatedPage: page }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Modal should be visible
    await expect(page.locator('dialog[open]')).toBeVisible();

    // Press Escape key to close the modal (native dialog behavior)
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(page.locator('dialog[open]')).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// Step 1 Form Tests
// ============================================================================

test.describe('AMB Resource Creation - Step 1 Form', () => {
  test('step 1 shows all required form fields', async ({ authenticatedPage: page }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Should show identifier (URL) field
    await expect(page.locator('#amb-identifier')).toBeVisible();

    // Should show title input (required)
    await expect(page.locator('#amb-title')).toBeVisible();

    // Should show description textarea (required)
    await expect(page.locator('#amb-description')).toBeVisible();

    // Should show language dropdown (required)
    await expect(page.locator('#amb-language')).toBeVisible();

    // Should show image URL field
    await expect(page.locator('#amb-image')).toBeVisible();
  });

  test('can fill step 1 form fields', async ({ authenticatedPage: page }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Fill in the form
    await page.locator('#amb-identifier').fill('https://example.com/resource');
    await page.locator('#amb-title').fill('Test Educational Resource');
    await page.locator('#amb-description').fill('A comprehensive test resource for E2E testing.');
    await page.locator('#amb-language').selectOption('en');
    await page.locator('#amb-image').fill('https://example.com/image.jpg');

    // Verify values are filled
    await expect(page.locator('#amb-title')).toHaveValue('Test Educational Resource');
    await expect(page.locator('#amb-description')).toHaveValue(
      'A comprehensive test resource for E2E testing.'
    );
  });

  test('cannot proceed without filling required fields', async ({ authenticatedPage: page }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Try to click Next without filling anything
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Should still be on step 1 (title input still visible)
    await expect(page.locator('#amb-title')).toBeVisible();

    // Now fill title only (still missing description)
    await page.locator('#amb-title').fill('Test Resource');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Should still be on step 1
    await expect(page.locator('#amb-title')).toBeVisible();
  });

  test('can proceed to step 2 with required fields filled', async ({ authenticatedPage: page }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Fill required fields
    await page.locator('#amb-title').fill('Test Educational Resource');
    await page.locator('#amb-description').fill('A test resource description.');
    await page.locator('#amb-language').selectOption('en');

    // Click Next
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Should be on step 2 - look for Resource Type label (use .first() to avoid strict mode)
    await expect(
      page.locator('text=Resource Type').or(page.locator('text=Ressourcentyp')).first()
    ).toBeVisible({ timeout: 5000 });

    // Back button should be visible
    await expect(page.locator('button:has-text("Back")')).toBeVisible();
  });

  test('can go back from step 2 to step 1', async ({ authenticatedPage: page }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Fill required fields and go to step 2
    await page.locator('#amb-title').fill('Test Resource');
    await page.locator('#amb-description').fill('Test description');
    await page.locator('#amb-language').selectOption('de');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Now on step 2, click Back
    await page.locator('button:has-text("Back")').click();
    await page.waitForTimeout(500);

    // Should be back on step 1 with form values preserved
    await expect(page.locator('#amb-title')).toBeVisible();
    await expect(page.locator('#amb-title')).toHaveValue('Test Resource');
    await expect(page.locator('#amb-description')).toHaveValue('Test description');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('AMB Resource Creation - Error Handling', () => {
  test('no critical JavaScript errors during modal interaction', async ({
    authenticatedPage: page
  }) => {
    const errorCapture = setupErrorCapture(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Fill step 1 form
    await page.locator('#amb-title').fill('Error Test Resource');
    await page.locator('#amb-description').fill('Testing for JS errors');
    await page.locator('#amb-language').selectOption('en');

    // Navigate to step 2
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Go back to step 1
    await page.locator('button:has-text("Back")').click();
    await page.waitForTimeout(500);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Assert no critical errors
    errorCapture.assertNoCriticalErrors();
  });
});
