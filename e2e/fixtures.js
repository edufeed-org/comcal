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
