/**
 * E2E tests for the Signup wizard flow.
 *
 * Tests the 4-step signup flow:
 * 1. Introduction
 * 2. Profile creation (name, about, picture, website)
 * 3. Key generation and backup
 * 4. Follow suggestions
 */
import { test, expect } from '@playwright/test';
import { setupErrorCapture } from './test-utils.js';

/**
 * Open the signup modal from the login modal.
 * @param {import('@playwright/test').Page} page
 */
async function openSignupModal(page) {
  // Navigate to home page
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Click the login button in navbar
  await page.locator('button:has-text("Login")').first().click();

  // Wait for login modal to appear
  await expect(page.locator('#global-login-modal')).toBeVisible({ timeout: 5000 });

  // Click Sign Up button in login modal
  await page.locator('#global-login-modal button:has-text("Sign Up")').click();

  // Wait for signup modal to appear
  await expect(page.locator('#global-signup-modal')).toBeVisible({ timeout: 5000 });
}

// ============================================================================
// Modal Access Tests
// ============================================================================

test.describe('Signup Wizard - Modal Access', () => {
  test('signup button opens modal from login modal', async ({ page }) => {
    await openSignupModal(page);

    // Verify signup modal is open
    await expect(page.locator('#global-signup-modal')).toBeVisible();
  });

  test('signup modal shows step indicator', async ({ page }) => {
    await openSignupModal(page);

    // Step indicator should show 4 steps
    const steps = page.locator('.steps .step');
    await expect(steps).toHaveCount(4);
  });

  test('signup modal starts at step 1', async ({ page }) => {
    await openSignupModal(page);

    // First step should be active (step-primary class)
    const firstStep = page.locator('.steps .step').first();
    await expect(firstStep).toHaveClass(/step-primary/);
  });
});

// ============================================================================
// Step 1 - Introduction Tests
// ============================================================================

test.describe('Signup Wizard - Step 1 (Introduction)', () => {
  test('step 1 shows introduction text', async ({ page }) => {
    await openSignupModal(page);

    // Should show introduction prose content
    await expect(page.locator('#global-signup-modal .prose')).toBeVisible();
  });

  test('can navigate to step 2 from introduction', async ({ page }) => {
    await openSignupModal(page);

    // Click Next button
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Should be on step 2 - profile form visible
    await expect(page.locator('#profile-name-input')).toBeVisible({ timeout: 5000 });
  });

  test('back button not visible on step 1', async ({ page }) => {
    await openSignupModal(page);

    // Back button should not be visible on first step
    await expect(page.locator('#global-signup-modal button:has-text("Back")')).not.toBeVisible();
  });
});

// ============================================================================
// Step 2 - Profile Creation Tests
// ============================================================================

test.describe('Signup Wizard - Step 2 (Profile Creation)', () => {
  /**
   * Helper to navigate to step 2
   * @param {import('@playwright/test').Page} page
   */
  async function goToStep2(page) {
    await openSignupModal(page);
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(500);
  }

  test('step 2 shows name input field', async ({ page }) => {
    await goToStep2(page);
    await expect(page.locator('#profile-name-input')).toBeVisible();
  });

  test('step 2 shows about textarea', async ({ page }) => {
    await goToStep2(page);
    await expect(page.locator('#profile-about-textarea')).toBeVisible();
  });

  test('step 2 shows profile picture URL input', async ({ page }) => {
    await goToStep2(page);
    await expect(page.locator('#profile-picture-url-input')).toBeVisible();
  });

  test('step 2 shows website input', async ({ page }) => {
    await goToStep2(page);
    await expect(page.locator('#profile-website-input')).toBeVisible();
  });

  test('can fill profile form fields', async ({ page }) => {
    await goToStep2(page);

    await page.locator('#profile-name-input').fill('Test User');
    await page.locator('#profile-about-textarea').fill('A test user for E2E testing');
    await page.locator('#profile-website-input').fill('https://example.com');

    // Verify values
    await expect(page.locator('#profile-name-input')).toHaveValue('Test User');
    await expect(page.locator('#profile-about-textarea')).toHaveValue(
      'A test user for E2E testing'
    );
  });

  test('cannot proceed to step 3 without name', async ({ page }) => {
    await goToStep2(page);

    // Try to click Next without filling name
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Should still be on step 2 (name input visible)
    await expect(page.locator('#profile-name-input')).toBeVisible();
  });

  test('can proceed to step 3 with name filled', async ({ page }) => {
    await goToStep2(page);

    // Fill name
    await page.locator('#profile-name-input').fill('Test User');

    // Click Next
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Should be on step 3 - public key visible
    await expect(page.locator('text=Public Key').or(page.locator('text=npub')).first()).toBeVisible(
      { timeout: 5000 }
    );
  });

  test('back button visible and works on step 2', async ({ page }) => {
    await goToStep2(page);

    // Back button should be visible
    await expect(page.locator('#global-signup-modal button:has-text("Back")')).toBeVisible();

    // Click back
    await page.locator('#global-signup-modal button:has-text("Back")').click();
    await page.waitForTimeout(500);

    // Should be back on step 1 (intro prose visible)
    await expect(page.locator('#global-signup-modal .prose')).toBeVisible();
  });
});

// ============================================================================
// Step 3 - Key Generation Tests
// ============================================================================

test.describe('Signup Wizard - Step 3 (Key Generation)', () => {
  /**
   * Helper to navigate to step 3
   * @param {import('@playwright/test').Page} page
   */
  async function goToStep3(page) {
    await openSignupModal(page);
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(500);
    await page.locator('#profile-name-input').fill('Test User');
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(1000);
  }

  test('step 3 generates and displays public key', async ({ page }) => {
    await goToStep3(page);

    // Public key (npub) should be visible in code block
    const publicKeyDisplay = page.locator('code').filter({ hasText: /^npub1/ });
    await expect(publicKeyDisplay).toBeVisible({ timeout: 10_000 });
  });

  test('step 3 shows download backup button', async ({ page }) => {
    await goToStep3(page);

    // Download button should be visible
    const downloadButton = page.locator('button:has-text("Download")').first();
    await expect(downloadButton).toBeVisible({ timeout: 10_000 });
  });

  test('step 3 shows encrypted backup option', async ({ page }) => {
    await goToStep3(page);

    // Encrypted password input should be visible
    await expect(page.locator('#encrypted-password-input')).toBeVisible({ timeout: 10_000 });
  });

  test('cannot proceed without downloading backup', async ({ page }) => {
    await goToStep3(page);

    // Try to click Next without downloading
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Should show error or still be on step 3
    const errorAlert = page.locator('.alert-error');
    const stillOnStep3 = await page.locator('#encrypted-password-input').isVisible();

    expect((await errorAlert.isVisible()) || stillOnStep3).toBe(true);
  });
});

// ============================================================================
// Step 4 - Follow Suggestions Tests
// ============================================================================

test.describe('Signup Wizard - Step 4 (Follow Suggestions)', () => {
  // Note: We cannot easily test step 4 without downloading the backup file
  // which triggers browser download dialogs that are hard to handle in E2E tests.
  // These tests verify the structure exists when navigated to.

  test('modal shows Cancel button', async ({ page }) => {
    await openSignupModal(page);

    // Cancel button should be visible
    await expect(page.locator('#global-signup-modal button:has-text("Cancel")')).toBeVisible();
  });

  test('cancel button closes modal', async ({ page }) => {
    await openSignupModal(page);

    // Click Cancel
    await page.locator('#global-signup-modal button:has-text("Cancel")').click();

    // Modal should close
    await expect(page.locator('#global-signup-modal')).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Signup Wizard - Error Handling', () => {
  test('no critical JavaScript errors during signup flow', async ({ page }) => {
    const errorCapture = setupErrorCapture(page);

    await openSignupModal(page);

    // Navigate to step 2
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Fill some fields
    await page.locator('#profile-name-input').fill('Error Test User');
    await page.locator('#profile-about-textarea').fill('Testing for errors');

    // Navigate to step 3
    await page.locator('#global-signup-modal button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Go back to step 2
    await page.locator('#global-signup-modal button:has-text("Back")').click();
    await page.waitForTimeout(500);

    // Close modal
    await page.locator('#global-signup-modal button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Assert no critical errors
    errorCapture.assertNoCriticalErrors();
  });
});
