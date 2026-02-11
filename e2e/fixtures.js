import { test as base, expect } from '@playwright/test';
import { TEST_AUTHOR } from './test-data.js';

/**
 * Extended Playwright test with authenticated page fixture.
 * The authenticatedPage fixture provides a page with a logged-in test user.
 */
export const test = base.extend({
  /**
   * Page with authenticated test user.
   * Uses UI-based login with nsec for reliable authentication.
   */
  authenticatedPage: async ({ page }, use) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for app initialization

    // Click the login button in navbar
    await page.locator('button:has-text("Login")').first().click();

    // Wait for login modal to appear
    await expect(page.locator('#global-login-modal')).toBeVisible({ timeout: 5000 });

    // Click NSEC login option (the button with "NSEC" text)
    await page.locator('#global-login-modal button:has-text("NSEC")').click();

    // Wait for NSEC input modal to appear
    await expect(page.locator('#global-private-key-modal')).toBeVisible({ timeout: 5000 });

    // Find and fill the nsec input
    const nsecInput = page.locator('#global-private-key-modal input').first();
    await nsecInput.fill(TEST_AUTHOR.nsec);

    // Click the login button (btn-primary class)
    await page.locator('#global-private-key-modal button.btn-primary').click();

    // After successful login, modal transitions to login modal showing accounts.
    // Wait for the transition and then close the modal.
    await page.waitForTimeout(1500);

    // Close any open modal by pressing Escape multiple times
    for (let i = 0; i < 3; i++) {
      const hasOpenModal = await page.locator('dialog[open]').isVisible();
      if (hasOpenModal) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        break;
      }
    }

    // Verify no modal is blocking
    await expect(async () => {
      const modalVisible = await page.locator('dialog[open]').isVisible();
      expect(modalVisible).toBe(false);
    }).toPass({ timeout: 10_000 });

    await use(page);
  }
});

export { expect };

/**
 * Helper to logout the current user.
 * Clicks the profile dropdown and logs out.
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Navigate to a page without overlapping hero elements
  await page.goto('/discover');
  await page.waitForTimeout(2000);

  // Click the profile avatar button to open dropdown
  await page.locator('.dropdown .btn-circle').click();

  // Wait for dropdown to open
  await page.waitForTimeout(300);

  // Click the logout button (contains "Logout" or similar text)
  await page
    .locator('.dropdown-content button')
    .filter({ hasText: /logout|abmelden/i })
    .first()
    .click();

  // Wait for logout to complete - login button should reappear
  await expect(page.locator('button:has-text("Login")')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to login with an nsec.
 * @param {import('@playwright/test').Page} page
 * @param {string} nsec - The nsec to login with
 */
export async function loginWithNsec(page, nsec) {
  // Click the login button in navbar
  await page.locator('button:has-text("Login")').first().click();

  // Wait for login modal to appear
  await expect(page.locator('#global-login-modal')).toBeVisible({ timeout: 5000 });

  // Click NSEC login option
  await page.locator('#global-login-modal button:has-text("NSEC")').click();

  // Wait for NSEC input modal to appear
  await expect(page.locator('#global-private-key-modal')).toBeVisible({ timeout: 5000 });

  // Find and fill the nsec input
  const nsecInput = page.locator('#global-private-key-modal input').first();
  await nsecInput.fill(nsec);

  // Click the login button
  await page.locator('#global-private-key-modal button.btn-primary').click();

  // Wait for login to complete
  await page.waitForTimeout(1500);

  // Close any open modal
  for (let i = 0; i < 3; i++) {
    const hasOpenModal = await page.locator('dialog[open]').isVisible();
    if (hasOpenModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }
}

/**
 * Helper to open the event creation modal on the calendar page.
 * Clicks the FAB and then the "Create Event" button.
 * @param {import('@playwright/test').Page} page
 */
export async function openEventCreationModal(page) {
  // Navigate to calendar page
  await page.goto('/calendar');
  await page.waitForTimeout(2000);

  // Click the FAB to expand it (the main button with role="button")
  await page.locator('.fab [role="button"]').click();
  await page.waitForTimeout(300);

  // Click the "Create Event" button
  await page.locator('button[data-tip="Create Event"]').click();

  // Wait for modal to appear
  await expect(page.locator('dialog[open] .modal-box')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to open the AMB resource creation modal on a community's Learning tab.
 * Navigates to the community, clicks the FAB, and opens the creation modal.
 * @param {import('@playwright/test').Page} page
 * @param {string} communityNpub - The community's npub (bech32)
 */
export async function openAMBCreationModal(page, communityNpub) {
  // Navigate to community page
  await page.goto(`/c/${communityNpub}`);
  await page.waitForTimeout(2000);

  // Wait for community sidebar to load
  await expect(page.locator('nav.menu').first()).toBeVisible({ timeout: 15000 });

  // Click on Learning tab using nav.menu button selector (matches community.test.js)
  await page.locator('nav.menu button', { hasText: 'Learning' }).click();
  await page.waitForTimeout(2000);

  // Wait for FAB to be visible (always present on Learning tab for authenticated users)
  await expect(page.locator('.fab').first()).toBeVisible({ timeout: 15000 });

  // Click the FAB to expand it (use first() for mobile/desktop FAB)
  await page.locator('.fab [role="button"]').first().click();
  await page.waitForTimeout(300);

  // Click the "Create Learning Content" button
  await page.locator('button[data-tip="Create Learning Content"]').first().click();

  // Wait for modal to appear (it's a native dialog element)
  await expect(page.locator('dialog[open] .modal-box')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to navigate to a calendar event detail page.
 * Uses client-side navigation since SSR is disabled for naddr routes.
 * @param {import('@playwright/test').Page} page
 * @param {string} naddr
 */
export async function navigateToCalendarEvent(page, naddr) {
  // First ensure we're on a page where SPA is loaded
  const currentUrl = page.url();
  if (!currentUrl.includes('localhost')) {
    await page.goto('/discover');
    await page.waitForTimeout(2000);
  }

  // Navigate via programmatic anchor click (works with SSR-disabled routes)
  await page.evaluate((url) => {
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, `/calendar/event/${naddr}`);

  // Wait for page to load (timedPool timeout + rendering)
  await page.waitForTimeout(4000);
}
