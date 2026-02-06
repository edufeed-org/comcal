import { test, expect } from '@playwright/test';

/**
 * Wait for content cards to appear on the discover page.
 * Includes time for timedPool (2s) to complete so pagination is ready.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout
 */
async function waitForContent(page, timeout = 30_000) {
	await page
		.locator('[data-testid="content-card"]')
		.first()
		.waitFor({ state: 'attached', timeout });
	// Allow timedPool (2s) to complete + debounced state updates + DOM rendering
	await page.waitForTimeout(2500);
}

/**
 * Count content cards currently in the DOM.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function getCardCount(page) {
	return page.locator('[data-testid="content-card"]').count();
}

/**
 * Scroll the infinite scroll sentinel into view and wait for loading.
 * @param {import('@playwright/test').Page} page
 */
async function triggerInfiniteScroll(page) {
	const sentinel = page.locator('#load-more-sentinel');
	await sentinel.scrollIntoViewIfNeeded();
	// Wait for: timedPool (2s) + WebSocket roundtrip + debounce + DOM update
	await page.waitForTimeout(4000);
}

test.describe('Discover page - infinite scroll', () => {
	test('All tab: loads initial content', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		const count = await getCardCount(page);
		expect(count).toBeGreaterThan(0);
	});

	test('All tab: infinite scroll loads more content', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		const initialCount = await getCardCount(page);

		await triggerInfiniteScroll(page);

		// Retry until count increases
		await expect(async () => {
			const newCount = await getCardCount(page);
			expect(newCount).toBeGreaterThan(initialCount);
		}).toPass({ timeout: 15_000 });
	});

	test('Events tab: loads calendar events and supports infinite scroll', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		await page.locator('[data-testid="tab-events"]').click();
		await page.waitForTimeout(500);

		// Wait for calendar event cards
		await expect(page.locator('.calendar-event-card-list').first()).toBeVisible({
			timeout: 15_000
		});

		const initialCount = await getCardCount(page);
		expect(initialCount).toBeGreaterThan(0);

		// No articles or AMB should be visible
		expect(await page.locator('.article-card-list').count()).toBe(0);
		expect(await page.locator('.amb-card-list').count()).toBe(0);

		// Trigger infinite scroll
		await triggerInfiniteScroll(page);

		await expect(async () => {
			const newCount = await getCardCount(page);
			expect(newCount).toBeGreaterThan(initialCount);
		}).toPass({ timeout: 15_000 });
	});

	test('Learning tab: loads AMB resources and supports infinite scroll', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		await page.locator('[data-testid="tab-learning"]').click();
		await page.waitForTimeout(500);

		await expect(page.locator('.amb-card-list').first()).toBeVisible({ timeout: 15_000 });

		const initialCount = await getCardCount(page);
		expect(initialCount).toBeGreaterThan(0);

		await triggerInfiniteScroll(page);

		// Verify pagination loaded more content
		await expect(async () => {
			const newCount = await getCardCount(page);
			expect(newCount).toBeGreaterThan(initialCount);
		}).toPass({ timeout: 10_000 });
	});

	test('Articles tab: loads articles and supports infinite scroll', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		await page.locator('[data-testid="tab-articles"]').click();
		await page.waitForTimeout(500);

		await expect(page.locator('.article-card-list').first()).toBeVisible({ timeout: 15_000 });

		const initialCount = await getCardCount(page);
		expect(initialCount).toBeGreaterThan(0);

		// No calendar events or AMB should be visible
		expect(await page.locator('.calendar-event-card-list').count()).toBe(0);
		expect(await page.locator('.amb-card-list').count()).toBe(0);

		await triggerInfiniteScroll(page);

		await expect(async () => {
			const newCount = await getCardCount(page);
			expect(newCount).toBeGreaterThan(initialCount);
		}).toPass({ timeout: 15_000 });
	});

	test('tab switching displays correct content types', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		// Switch to Events
		await page.locator('[data-testid="tab-events"]').click();
		await expect(page.locator('.calendar-event-card-list').first()).toBeVisible({
			timeout: 15_000
		});
		expect(await page.locator('.article-card-list').count()).toBe(0);
		expect(await page.locator('.amb-card-list').count()).toBe(0);

		// Switch to Articles
		await page.locator('[data-testid="tab-articles"]').click();
		await expect(page.locator('.article-card-list').first()).toBeVisible({ timeout: 15_000 });
		expect(await page.locator('.calendar-event-card-list').count()).toBe(0);
		expect(await page.locator('.amb-card-list').count()).toBe(0);

		// Switch to Learning
		await page.locator('[data-testid="tab-learning"]').click();
		await expect(page.locator('.amb-card-list').first()).toBeVisible({ timeout: 15_000 });
		expect(await page.locator('.article-card-list').count()).toBe(0);
		expect(await page.locator('.calendar-event-card-list').count()).toBe(0);

		// Switch back to All - should have mixed content
		await page.locator('[data-testid="tab-all"]').click();
		await page.waitForTimeout(1000);
		const total = await getCardCount(page);
		expect(total).toBeGreaterThan(0);
	});

	test('Learning tab: no loading flicker during infinite scroll', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		await page.locator('[data-testid="tab-learning"]').click();
		await page.waitForTimeout(500);
		await expect(page.locator('.amb-card-list').first()).toBeVisible({ timeout: 15_000 });

		// Inject a counter that tracks how many times the loading spinner appears
		await page.evaluate(() => {
			window.__loadingFlickerCount = 0;
			const sentinel = document.getElementById('load-more-sentinel');
			const observer = new MutationObserver(() => {
				if (sentinel.querySelector('.loading-spinner')) {
					window.__loadingFlickerCount++;
				}
			});
			observer.observe(sentinel, { childList: true, subtree: true });
		});

		// Trigger one scroll
		await triggerInfiniteScroll(page);

		const flickerCount = await page.evaluate(() => window.__loadingFlickerCount);
		// The spinner may appear once per batch (50 AMB / 20 batch = 3 batches).
		// The original flicker bug caused rapid toggling within a single batch (10+).
		expect(flickerCount).toBeLessThanOrEqual(5);
	});

	test('Articles tab: shows "no more content" after all items loaded', async ({ page }) => {
		await page.goto('/discover');
		await waitForContent(page);

		await page.locator('[data-testid="tab-articles"]').click();
		await page.waitForTimeout(500);
		await expect(page.locator('.article-card-list').first()).toBeVisible({ timeout: 15_000 });

		// Scroll repeatedly until all content is exhausted (50 articles / 20 batch = 3 scrolls)
		// Each scroll needs timedPool (2s) + buffer to complete
		for (let i = 0; i < 6; i++) {
			const sentinel = page.locator('#load-more-sentinel');
			await sentinel.scrollIntoViewIfNeeded();
			await page.waitForTimeout(4000);
		}

		// "No more content to load" should be visible - wait longer for final pagination to complete
		await expect(page.getByText('No more content to load')).toBeVisible({ timeout: 15_000 });
	});

	test('Learning tab: spinner stops after all content loaded', async ({ page }) => {
		// This test exercises the hanging relay (sends events but never EOSE for kind 30142).
		// Without the timedPool fix, the spinner spins forever.
		test.setTimeout(180_000);

		await page.goto('/discover');
		await waitForContent(page);

		await page.locator('[data-testid="tab-learning"]').click();
		await page.waitForTimeout(500);
		await expect(page.locator('.amb-card-list').first()).toBeVisible({ timeout: 15_000 });

		// Scroll repeatedly to trigger loading
		// Each scroll needs timedPool (2s) + buffer to complete
		for (let i = 0; i < 10; i++) {
			await page.locator('#load-more-sentinel').scrollIntoViewIfNeeded();
			await page.waitForTimeout(4000);
		}

		// "No more content" must appear — proves the spinner stops
		await expect(page.getByText('No more content to load')).toBeVisible({ timeout: 45_000 });
	});

	test('page loads without critical JavaScript errors', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));

		await page.goto('/discover');
		await waitForContent(page);

		// Filter benign network errors (WebSocket reconnection, fetch failures)
		const critical = errors.filter(
			(e) => !e.includes('WebSocket') && !e.includes('net::') && !e.includes('fetch')
		);
		expect(critical).toHaveLength(0);
	});
});
