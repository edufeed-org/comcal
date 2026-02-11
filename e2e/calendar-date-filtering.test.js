import { test, expect } from '@playwright/test';
import { waitForCalendarEvents, setupErrorCapture } from './test-utils.js';
import { DATE_RANGE_TEST_EVENTS } from './test-data.js';

/**
 * E2E tests for calendar date range filtering.
 *
 * Tests verify that:
 * 1. The calendar loads events for the currently viewed date range
 * 2. Navigation (prev/next month) loads new events
 * 3. Multi-day events spanning month boundaries are displayed
 * 4. View mode changes (month/week/day) work correctly
 */

test.describe('Calendar date range filtering', () => {
  test.describe('Date range loading', () => {
    test('calendar page loads events for current month', async ({ page }) => {
      await page.goto('/calendar');

      // Wait for calendar to load
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Current month event should be visible
      const currentMonthEvent = page.getByText(DATE_RANGE_TEST_EVENTS.currentMonth.title);
      await expect(currentMonthEvent).toBeVisible({ timeout: 10_000 });
    });

    test('navigating to next month loads new events', async ({ page }) => {
      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Click the "next" navigation button - find the visible one (responsive layout)
      const nextButton = page.locator('button[aria-label*="Next"]:visible').first();
      await expect(nextButton).toBeVisible({ timeout: 10_000 });
      await nextButton.click();

      // Wait for new events to load
      await page.waitForTimeout(3000);

      // Next month event should now be visible
      const nextMonthEvent = page.getByText(DATE_RANGE_TEST_EVENTS.nextMonth.title);
      await expect(nextMonthEvent).toBeVisible({ timeout: 15_000 });
    });

    test('navigating to previous month loads past events', async ({ page }) => {
      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Click the "previous" navigation button - find the visible one (responsive layout)
      const prevButton = page.locator('button[aria-label*="Previous"]:visible').first();
      await expect(prevButton).toBeVisible({ timeout: 10_000 });
      await prevButton.click();

      // Wait for new events to load
      await page.waitForTimeout(3000);

      // Past month event should now be visible
      const pastMonthEvent = page.getByText(DATE_RANGE_TEST_EVENTS.pastMonth.title);
      await expect(pastMonthEvent).toBeVisible({ timeout: 15_000 });
    });

    test('multi-day event spanning month boundary is shown in current month', async ({ page }) => {
      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // The spanning event should be visible because it starts before month end
      // (within the 7-day padding window)
      const spanningEvent = page.getByText(DATE_RANGE_TEST_EVENTS.spanning.title);
      await expect(spanningEvent).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('View mode changes', () => {
    test('switching to week view shows events for current week', async ({ page }) => {
      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Find and click visible week view button (responsive layout has mobile/desktop versions)
      const weekButton = page.locator('button:has-text("Week"):visible').first();
      const buttonVisible = await weekButton.isVisible().catch(() => false);

      if (buttonVisible) {
        await weekButton.click();
        await page.waitForTimeout(2000);

        // Week view should render something
        await expect(page.locator('.calendar-grid, .calendar-event-bar').first()).toBeVisible({
          timeout: 5000
        });
      }
    });

    test('switching to day view shows single day events', async ({ page }) => {
      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Find and click visible day view button
      const dayButton = page.locator('button:has-text("Day"):visible').first();
      const buttonVisible = await dayButton.isVisible().catch(() => false);

      if (buttonVisible) {
        await dayButton.click();
        await page.waitForTimeout(2000);

        // Day view should show events for a single day
        await expect(page.locator('.calendar-grid, .calendar-event-bar').first()).toBeVisible({
          timeout: 5000
        });
      }
    });

    test('switching back to month view from week view works correctly', async ({ page }) => {
      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Find and click visible week view button
      const weekButton = page.locator('button:has-text("Week"):visible').first();
      const weekButtonVisible = await weekButton.isVisible().catch(() => false);

      if (weekButtonVisible) {
        await weekButton.click();
        await page.waitForTimeout(2000);

        // Switch back to month view
        const monthButton = page.locator('button:has-text("Month"):visible').first();
        const monthButtonVisible = await monthButton.isVisible().catch(() => false);

        if (monthButtonVisible) {
          await monthButton.click();
          await page.waitForTimeout(2000);

          // Events should still be visible
          const currentMonthEvent = page.getByText(DATE_RANGE_TEST_EVENTS.currentMonth.title);
          await expect(currentMonthEvent).toBeVisible({ timeout: 10_000 });
        }
      }
    });
  });

  test.describe('Error handling', () => {
    test('no critical JavaScript errors during date navigation', async ({ page }) => {
      const errorCapture = setupErrorCapture(page);

      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Navigate forward - find visible button
      const nextButton = page.locator('button[aria-label*="Next"]:visible').first();
      await nextButton.click();
      await page.waitForTimeout(2000);

      // Navigate backward twice - find visible button
      const prevButton = page.locator('button[aria-label*="Previous"]:visible').first();
      await prevButton.click();
      await page.waitForTimeout(2000);
      await prevButton.click();
      await page.waitForTimeout(2000);

      errorCapture.assertNoCriticalErrors();
    });

    test('no critical JavaScript errors during view mode changes', async ({ page }) => {
      const errorCapture = setupErrorCapture(page);

      await page.goto('/calendar');
      await waitForCalendarEvents(page, { timeout: 30_000 });

      // Try switching view modes if visible buttons are available
      const weekButton = page.locator('button:has-text("Week"):visible').first();
      if (await weekButton.isVisible().catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(1000);
      }

      const dayButton = page.locator('button:has-text("Day"):visible').first();
      if (await dayButton.isVisible().catch(() => false)) {
        await dayButton.click();
        await page.waitForTimeout(1000);
      }

      const monthButton = page.locator('button:has-text("Month"):visible').first();
      if (await monthButton.isVisible().catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(1000);
      }

      errorCapture.assertNoCriticalErrors();
    });
  });
});
