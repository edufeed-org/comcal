import { test, expect } from '@playwright/test';
import { TEST_NADDRS } from './test-data.js';
import { waitForContent, setupErrorCapture } from './test-utils.js';

/**
 * Navigate to an naddr route using client-side navigation.
 * The naddr route's load() depends on relay infrastructure that only
 * exists client-side, so we first boot the SPA on a working page,
 * then trigger an internal navigation via anchor click.
 * @param {import('@playwright/test').Page} page
 * @param {string} naddr
 */
async function navigateToNaddr(page, naddr) {
  // Boot the SPA on a page that works with SSR
  await page.goto('/discover');
  await waitForContent(page);

  // Trigger SvelteKit client-side navigation by clicking an internal link
  await page.evaluate((url) => {
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, `/${naddr}`);

  // Wait for the client-side navigation to complete
  // Need time for relay data to load after navigation
  await page.waitForTimeout(3000);
}

test.describe('Event detail page - naddr routes', () => {
  test('article detail page loads and shows content', async ({ page }) => {
    await navigateToNaddr(page, TEST_NADDRS.article);

    // Wait for article to load — test data title is "Introduction to Mathematics #0"
    // Use a specific selector to avoid matching the svelte-announcer
    await expect(
      page.locator('article h1, [class*="article"] h1, .container h1').first()
    ).toContainText('Introduction to Mathematics #0', { timeout: 15_000 });

    // Article content should be rendered
    await expect(page.locator('article').getByText('Content for article 0')).toBeVisible();
  });

  test('calendar date event detail page loads', async ({ page }) => {
    await navigateToNaddr(page, TEST_NADDRS.calendarDate);

    // The CalendarView renders the event title in the sidebar list or page body
    await expect(async () => {
      const pageContent = await page.locator('body').textContent();
      expect(pageContent).toContain('Mathematics Workshop');
    }).toPass({ timeout: 15_000 });
  });

  test('AMB resource detail page loads', async ({ page }) => {
    await navigateToNaddr(page, TEST_NADDRS.amb);

    // AMB resource renders in an <article> element with title and description
    await expect(page.locator('article h1').first()).toContainText('Mathematics', {
      timeout: 15_000
    });
  });

  test('no critical JavaScript errors on article page', async ({ page }) => {
    const errorCapture = setupErrorCapture(page);

    await navigateToNaddr(page, TEST_NADDRS.article);

    // Wait for article content to load
    await expect(
      page.locator('article h1, [class*="article"] h1, .container h1').first()
    ).toBeVisible({ timeout: 15_000 });

    errorCapture.assertNoCriticalErrors();
  });
});
