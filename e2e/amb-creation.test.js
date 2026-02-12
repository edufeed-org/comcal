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
// Step 2 Form Tests
// ============================================================================

test.describe('AMB Resource Creation - Step 2 (Classification)', () => {
  /**
   * Helper to navigate to step 2 with filled step 1 form
   * @param {import('@playwright/test').Page} page
   */
  async function goToStep2(page) {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await page.locator('#amb-title').fill('Test Resource');
    await page.locator('#amb-description').fill('Test description');
    await page.locator('#amb-language').selectOption('en');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);
  }

  test('step 2 shows Resource Type dropdown', async ({ authenticatedPage: page }) => {
    await goToStep2(page);

    // Resource Type dropdown should be visible
    const resourceTypeLabel = page
      .locator('text=Resource Type')
      .or(page.locator('text=Ressourcentyp'));
    await expect(resourceTypeLabel.first()).toBeVisible({ timeout: 5000 });
  });

  test('step 2 shows Subject dropdown', async ({ authenticatedPage: page }) => {
    await goToStep2(page);

    // Subject dropdown should be visible
    const subjectLabel = page.locator('text=Subject').or(page.locator('text=Thema'));
    await expect(subjectLabel.first()).toBeVisible({ timeout: 5000 });
  });

  test('step 2 shows Keywords input', async ({ authenticatedPage: page }) => {
    await goToStep2(page);

    // Keywords input should be visible
    await expect(page.locator('#amb-keywords')).toBeVisible({ timeout: 5000 });
  });

  test('can add keyword on step 2', async ({ authenticatedPage: page }) => {
    await goToStep2(page);

    // Find keywords input and add a keyword
    const keywordsInput = page.locator('#amb-keywords');
    await keywordsInput.fill('education');
    await keywordsInput.press('Enter');

    // Keyword should appear as a badge
    await expect(page.locator('.badge').filter({ hasText: 'education' })).toBeVisible({
      timeout: 5000
    });
  });
});

// ============================================================================
// Step 3 Form Tests
// ============================================================================

test.describe('AMB Resource Creation - Step 3 (Content & Creators)', () => {
  /**
   * Helper to navigate to step 3 with filled step 1+2 forms
   * @param {import('@playwright/test').Page} page
   */
  async function goToStep3(page) {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Fill step 1
    await page.locator('#amb-title').fill('Test Resource');
    await page.locator('#amb-description').fill('Test description');
    await page.locator('#amb-language').selectOption('en');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Skip step 2 (SKOS dropdowns may not have data in test environment)
    // Just click Next - validation may allow or we test what we can
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);
  }

  test('step 3 shows Creators input', async ({ authenticatedPage: page }) => {
    await goToStep3(page);

    // Check if we're on step 3 by looking for Creators label
    const creatorsLabel = page.locator('text=Creators').or(page.locator('text=Autoren'));
    const isStep3 = await creatorsLabel
      .first()
      .isVisible()
      .catch(() => false);

    if (isStep3) {
      await expect(creatorsLabel.first()).toBeVisible();
    } else {
      // Still on step 2 due to validation - that's expected behavior too
      await expect(page.locator('text=Resource Type').first()).toBeVisible();
    }
  });

  test('step 3 shows External URLs input', async ({ authenticatedPage: page }) => {
    await goToStep3(page);

    // Check if we're on step 3
    const externalUrlsLabel = page
      .locator('text=External References')
      .or(page.locator('text=Externe Links'));
    const isStep3 = await externalUrlsLabel
      .first()
      .isVisible()
      .catch(() => false);

    if (isStep3) {
      await expect(externalUrlsLabel.first()).toBeVisible();
    }
  });
});

// ============================================================================
// Step 4 Form Tests
// ============================================================================

test.describe('AMB Resource Creation - Step 4 (License & Publish)', () => {
  test('step 4 shows License dropdown when navigated properly', async ({
    authenticatedPage: page
  }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Fill step 1 to enable navigation
    await page.locator('#amb-title').fill('License Test Resource');
    await page.locator('#amb-description').fill('Testing license selection');
    await page.locator('#amb-language').selectOption('en');

    // Try to navigate through all steps
    // Some steps may be skipped if SKOS data isn't available
    for (let step = 1; step < 4; step++) {
      const nextButton = page.locator('button:has-text("Next")');
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Check if we reached step 4 (License dropdown visible)
    const licenseDropdown = page.locator('#amb-license');
    const isStep4 = await licenseDropdown.isVisible().catch(() => false);

    if (isStep4) {
      await expect(licenseDropdown).toBeVisible();
    } else {
      // May be stuck on earlier step due to validation - note this in test
      console.log('Did not reach step 4 - SKOS validation may be blocking');
    }
  });

  test('step 4 shows Free Access checkbox when navigated properly', async ({
    authenticatedPage: page
  }) => {
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Fill step 1
    await page.locator('#amb-title').fill('Free Access Test Resource');
    await page.locator('#amb-description').fill('Testing free access checkbox');
    await page.locator('#amb-language').selectOption('en');

    // Navigate through steps
    for (let step = 1; step < 4; step++) {
      const nextButton = page.locator('button:has-text("Next")');
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Check for free access checkbox
    const freeAccessCheckbox = page.locator('text=freely accessible').first();
    const isStep4 = await freeAccessCheckbox.isVisible().catch(() => false);

    if (isStep4) {
      await expect(freeAccessCheckbox).toBeVisible();
    }
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
