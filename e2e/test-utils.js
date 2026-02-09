/**
 * Shared E2E test utilities for ComCal.
 * Contains reusable helpers for waiting, error capture, and common patterns.
 */
import { expect } from '@playwright/test';

// ============================================================================
// Error Capture
// ============================================================================

/**
 * Setup error capture for a page. Call at the start of a test to capture
 * JavaScript errors that occur during the test.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {{ assertNoCriticalErrors: () => void }}
 */
export function setupErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  return {
    /**
     * Assert no critical JavaScript errors occurred.
     * Filters out expected network errors (WebSocket, fetch, net::).
     */
    assertNoCriticalErrors: () => {
      const critical = errors.filter(
        (e) => !e.includes('WebSocket') && !e.includes('net::') && !e.includes('fetch')
      );
      expect(critical).toHaveLength(0);
    }
  };
}

// ============================================================================
// Smart Wait Helpers
// ============================================================================

/**
 * Wait for content cards to appear on the discover page.
 * Includes time for timedPool (2s) to complete so pagination is ready.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 */
export async function waitForContent(page, options = {}) {
  const timeout = options.timeout || 30_000;
  await page
    .locator('[data-testid="content-card"]')
    .first()
    .waitFor({ state: 'attached', timeout });
  // Allow timedPool (2s) to complete + debounced state updates + DOM rendering
  await page.waitForTimeout(2500);
}

/**
 * Count content cards currently in the DOM.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function getCardCount(page) {
  return page.locator('[data-testid="content-card"]').count();
}

/**
 * Scroll the infinite scroll sentinel into view and wait for loading.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function triggerInfiniteScroll(page) {
  const sentinel = page.locator('#load-more-sentinel');
  await sentinel.scrollIntoViewIfNeeded();
  // Wait for: timedPool (2s) + WebSocket roundtrip + debounce + DOM update
  await page.waitForTimeout(4000);
}

/**
 * Wait for calendar events to load on the calendar page.
 * Supports both grid view (calendar-event-bar) and list view (calendar-event-card).
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} [options.timeout=15000] - Timeout in milliseconds
 */
export async function waitForCalendarEvents(page, options = {}) {
  const timeout = options.timeout || 15_000;
  // Try grid view first (CalendarEventBar), then fall back to card view
  const gridEvent = page.locator('.calendar-event-bar').first();
  const cardEvent = page.locator('[data-testid="calendar-event-card"]').first();

  // Wait for either grid or card events to appear
  await expect(gridEvent.or(cardEvent)).toBeVisible({ timeout });
}

/**
 * Wait for comments section to be ready on event detail page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} [options.timeout=15000] - Timeout in milliseconds
 */
export async function waitForComments(page, options = {}) {
  const timeout = options.timeout || 15_000;
  await expect(page.locator('[data-testid="comment-list"]')).toBeVisible({ timeout });
}

/**
 * Wait for profile page to load (no testid available, uses heading).
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} [options.timeout=15000] - Timeout in milliseconds
 */
export async function waitForProfile(page, options = {}) {
  const timeout = options.timeout || 15_000;
  await expect(page.locator('h1').first()).toBeVisible({ timeout });
}

/**
 * Wait for community page structure to load (sidebar visible).
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} [options.timeout=15000] - Timeout in milliseconds
 */
export async function waitForCommunitySidebar(page, options = {}) {
  const timeout = options.timeout || 15_000;
  await expect(page.locator('nav.menu').first()).toBeVisible({ timeout });
}

/**
 * Wait for event detail page to load.
 * Waits for the main title/heading to appear.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} [options.timeout=15000] - Timeout in milliseconds
 */
export async function waitForEventDetail(page, options = {}) {
  const timeout = options.timeout || 15_000;
  // Wait for main heading or title to be visible
  await expect(page.locator('h1, h2, [data-testid="event-title"]').first()).toBeVisible({
    timeout
  });
}
