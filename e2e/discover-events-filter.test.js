import { test, expect } from '@playwright/test';
import { waitForContent, setupErrorCapture } from './test-utils.js';

test.describe('Discover page - Events date range filter', () => {
  test('date range filter is visible on events tab', async ({ page }) => {
    await page.goto('/discover');
    await waitForContent(page);

    // Switch to Events tab
    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(500);

    // Date range filter should be visible
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 10_000
    });

    // Should display a date range (e.g., "Feb 2026 - May 2026")
    const displayText = await page.locator('[data-testid="date-range-display"]').textContent();
    expect(displayText).toMatch(/\w+ \d{4} - \w+ \d{4}/);
  });

  test('prev button shifts date range backward', async ({ page }) => {
    await page.goto('/discover');
    await waitForContent(page);

    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 10_000
    });

    // Get initial range text
    const initialRange = await page.locator('[data-testid="date-range-display"]').textContent();

    // Click prev button
    await page.locator('[data-testid="date-range-prev"]').click();
    await page.waitForTimeout(1000);

    // Range should have changed
    const newRange = await page.locator('[data-testid="date-range-display"]').textContent();
    expect(newRange).not.toBe(initialRange);

    // URL should have eventStart and eventEnd params
    expect(page.url()).toContain('eventStart=');
    expect(page.url()).toContain('eventEnd=');
  });

  test('next button shifts date range forward', async ({ page }) => {
    await page.goto('/discover');
    await waitForContent(page);

    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 10_000
    });

    // Get initial range text
    const initialRange = await page.locator('[data-testid="date-range-display"]').textContent();

    // Click next button
    await page.locator('[data-testid="date-range-next"]').click();
    await page.waitForTimeout(1000);

    // Range should have changed
    const newRange = await page.locator('[data-testid="date-range-display"]').textContent();
    expect(newRange).not.toBe(initialRange);

    // URL should have eventStart and eventEnd params
    expect(page.url()).toContain('eventStart=');
    expect(page.url()).toContain('eventEnd=');
  });

  test('today button appears after navigating away and resets range', async ({ page }) => {
    await page.goto('/discover');
    await waitForContent(page);

    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 10_000
    });

    // Today button should NOT be visible initially (we're already at today)
    await expect(page.locator('[data-testid="date-range-today"]')).not.toBeVisible();

    // Navigate to past (prev)
    await page.locator('[data-testid="date-range-prev"]').click();
    await page.waitForTimeout(1000);

    // Now Today button should appear
    await expect(page.locator('[data-testid="date-range-today"]')).toBeVisible();

    // Click Today to reset
    const rangeAfterPrev = await page.locator('[data-testid="date-range-display"]').textContent();
    await page.locator('[data-testid="date-range-today"]').click();
    await page.waitForTimeout(1000);

    // Range should have changed back
    const rangeAfterToday = await page.locator('[data-testid="date-range-display"]').textContent();
    expect(rangeAfterToday).not.toBe(rangeAfterPrev);

    // Today button should be hidden again
    await expect(page.locator('[data-testid="date-range-today"]')).not.toBeVisible();
  });

  test('date range persists in URL and survives page reload', async ({ page }) => {
    await page.goto('/discover?type=events');
    await page.waitForTimeout(1000);

    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 15_000
    });

    // Navigate to a different date range
    await page.locator('[data-testid="date-range-next"]').click();
    await page.waitForTimeout(1500);

    // Get the current range and URL
    const rangeBeforeReload = await page
      .locator('[data-testid="date-range-display"]')
      .textContent();
    const urlBeforeReload = page.url();

    expect(urlBeforeReload).toContain('eventStart=');
    expect(urlBeforeReload).toContain('eventEnd=');

    // Reload the page with full URL (preserving params)
    await page.goto(urlBeforeReload);
    await page.waitForTimeout(2000);

    // The date range filter should be visible (type=events is in URL)
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 15_000
    });

    const rangeAfterReload = await page.locator('[data-testid="date-range-display"]').textContent();
    expect(rangeAfterReload).toBe(rangeBeforeReload);
  });

  test('custom date picker opens and applies range', async ({ page }) => {
    await page.goto('/discover');
    await waitForContent(page);

    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 10_000
    });

    // Click on date range display to open picker
    await page.locator('[data-testid="date-range-display"]').click();
    await page.waitForTimeout(500);

    // Modal should be visible
    await expect(page.locator('[data-testid="date-range-modal"]')).toBeVisible();

    // Fill in custom dates (June 2026 - September 2026)
    await page.locator('[data-testid="date-range-start-input"]').fill('2026-06-01');
    await page.locator('[data-testid="date-range-end-input"]').fill('2026-09-01');

    // Click apply
    await page.locator('[data-testid="date-range-apply"]').click();
    await page.waitForTimeout(1000);

    // Modal should close
    await expect(page.locator('[data-testid="date-range-modal"]')).not.toBeVisible();

    // Range should show June - September 2026
    const newRange = await page.locator('[data-testid="date-range-display"]').textContent();
    expect(newRange).toContain('2026');

    // URL should have updated params
    expect(page.url()).toContain('eventStart=');
    expect(page.url()).toContain('eventEnd=');
  });

  test('custom date picker cancel button closes modal without changes', async ({ page }) => {
    await page.goto('/discover');
    await waitForContent(page);

    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 10_000
    });

    // Get initial range
    const initialRange = await page.locator('[data-testid="date-range-display"]').textContent();

    // Open picker
    await page.locator('[data-testid="date-range-display"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="date-range-modal"]')).toBeVisible();

    // Fill in dates
    await page.locator('[data-testid="date-range-start-input"]').fill('2027-01-01');
    await page.locator('[data-testid="date-range-end-input"]').fill('2027-06-01');

    // Click cancel
    await page.locator('[data-testid="date-range-cancel"]').click();
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('[data-testid="date-range-modal"]')).not.toBeVisible();

    // Range should be unchanged
    const rangeAfterCancel = await page.locator('[data-testid="date-range-display"]').textContent();
    expect(rangeAfterCancel).toBe(initialRange);
  });

  test('date range filter not visible on other tabs', async ({ page }) => {
    await page.goto('/discover');
    await waitForContent(page);

    // Switch to Learning tab
    await page.locator('[data-testid="tab-learning"]').click();
    await page.waitForTimeout(500);

    // Date range filter should NOT be visible
    await expect(page.locator('[data-testid="date-range-filter"]')).not.toBeVisible();

    // Switch to Articles tab
    await page.locator('[data-testid="tab-articles"]').click();
    await page.waitForTimeout(500);

    // Date range filter should still NOT be visible
    await expect(page.locator('[data-testid="date-range-filter"]')).not.toBeVisible();

    // Switch to All tab
    await page.locator('[data-testid="tab-all"]').click();
    await page.waitForTimeout(500);

    // Date range filter should NOT be visible on All tab either
    await expect(page.locator('[data-testid="date-range-filter"]')).not.toBeVisible();
  });

  test('no critical JavaScript errors during date navigation', async ({ page }) => {
    const errorCapture = setupErrorCapture(page);

    await page.goto('/discover');
    await waitForContent(page);

    await page.locator('[data-testid="tab-events"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible({
      timeout: 10_000
    });

    // Navigate prev
    await page.locator('[data-testid="date-range-prev"]').click();
    await page.waitForTimeout(1000);

    // Navigate next
    await page.locator('[data-testid="date-range-next"]').click();
    await page.waitForTimeout(1000);

    // Navigate prev again to make Today button visible
    await page.locator('[data-testid="date-range-prev"]').click();
    await page.waitForTimeout(1000);

    // Click today (only if visible - it appears after navigating away from today)
    const todayButton = page.locator('[data-testid="date-range-today"]');
    if (await todayButton.isVisible()) {
      await todayButton.click();
      await page.waitForTimeout(1000);
    }

    // Open and close picker
    await page.locator('[data-testid="date-range-display"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="date-range-cancel"]').click();
    await page.waitForTimeout(500);

    errorCapture.assertNoCriticalErrors();
  });
});
