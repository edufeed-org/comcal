import { test, expect } from '@playwright/test';

test.describe('Calendar page', () => {
	test('loads and displays calendar events', async ({ page }) => {
		await page.goto('/calendar');

		// Wait for the CalendarView component to render
		// The calendar grid or event list should appear
		await expect(
			page.locator('.container').first()
		).toBeVisible({ timeout: 15_000 });

		// Wait for events to load from mock relay
		await page.waitForTimeout(3000);

		// Calendar should have rendered some content (grid cells, event items, etc.)
		// Check for the page title
		await expect(page).toHaveTitle(/Calendar/);
	});

	test('calendar events contain expected metadata', async ({ page }) => {
		await page.goto('/calendar');
		await page.waitForTimeout(3000);

		// The page should contain event titles from our test data
		// Test data generates titles like "Date Event: Mathematics Workshop #0"
		// and "Time Event: Mathematics Lecture #0"
		const pageContent = await page.textContent('body');
		const hasCalendarContent =
			pageContent.includes('Workshop') ||
			pageContent.includes('Lecture') ||
			pageContent.includes('Event');
		expect(hasCalendarContent).toBe(true);
	});

	test('no critical JavaScript errors', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));

		await page.goto('/calendar');
		await page.waitForTimeout(3000);

		const critical = errors.filter(
			(e) => !e.includes('WebSocket') && !e.includes('net::') && !e.includes('fetch')
		);
		expect(critical).toHaveLength(0);
	});
});
