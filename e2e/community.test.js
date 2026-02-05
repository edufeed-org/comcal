import { test, expect } from '@playwright/test';
import { TEST_COMMUNITY, TEST_COUNTS } from './test-data.js';

const COMMUNITY_URL = `/c/${TEST_COMMUNITY.npub}`;

/**
 * Navigate to a community page and wait for it to load.
 * @param {import('@playwright/test').Page} page
 */
async function navigateToCommunity(page) {
	await page.goto(COMMUNITY_URL);
	// Wait for the community page layout to render (desktop nav sidebar)
	await page.locator('nav.menu').waitFor({ state: 'attached', timeout: 15_000 });
	await page.waitForTimeout(500);
}

/**
 * Click a tab button in the desktop content nav sidebar.
 * @param {import('@playwright/test').Page} page
 * @param {string} label - Tab label text (e.g., "Learning", "Chat")
 */
async function clickNavTab(page, label) {
	await page.locator('nav.menu button', { hasText: label }).click();
	await page.waitForTimeout(1000);
}

test.describe('Community page - Learning tab', () => {
	test('loads community AMB resources', async ({ page }) => {
		await navigateToCommunity(page);
		await clickNavTab(page, 'Learning');

		// Wait for AMB resource cards to appear
		await expect(page.locator('.amb-card').first()).toBeVisible({ timeout: 15_000 });

		// Both desktop and mobile layouts render MainContentArea (mobile hidden via CSS),
		// so DOM contains cards from both. Check >= expected count.
		const count = await page.locator('.amb-card').count();
		expect(count).toBeGreaterThanOrEqual(TEST_COUNTS.communityAMB);
	});

	test('shows author profile names on resource cards', async ({ page }) => {
		await navigateToCommunity(page);
		await clickNavTab(page, 'Learning');

		// Wait for cards to appear
		await expect(page.locator('.amb-card').first()).toBeVisible({ timeout: 15_000 });

		// Wait for profiles to load asynchronously via replaceableLoader
		// Profiles resolve via EventStore batching (bufferTime: 1000ms)
		await expect(async () => {
			const authorNames = await page.locator('.amb-card .font-medium').allTextContents();
			// At least one card should show a resolved profile name (not a truncated pubkey)
			const hasProfileName = authorNames.some((name) => name.includes('Test Author'));
			expect(hasProfileName).toBe(true);
		}).toPass({ timeout: 15_000 });
	});
});

test.describe('Community page - Chat tab', () => {
	test('loads community chat messages', async ({ page }) => {
		await navigateToCommunity(page);
		await clickNavTab(page, 'Chat');

		// Wait for chat bubbles to appear (DaisyUI .chat class)
		await expect(page.locator('.chat').first()).toBeVisible({ timeout: 15_000 });

		const count = await page.locator('.chat').count();
		expect(count).toBeGreaterThanOrEqual(TEST_COUNTS.communityChat);

		// Verify message content is visible
		await expect(page.locator('.chat-bubble', { hasText: 'Hello from Test Author' }).first()).toBeVisible();
	});

	test('shows sender profile names on messages', async ({ page }) => {
		await navigateToCommunity(page);
		await clickNavTab(page, 'Chat');

		// Wait for chat messages to appear
		await expect(page.locator('.chat').first()).toBeVisible({ timeout: 15_000 });

		// Wait for profiles to load
		await expect(async () => {
			const senderNames = await page.locator('.chat-header .font-semibold').allTextContents();
			// At least one message should show a resolved profile name
			const hasProfileName = senderNames.some((name) => name.includes('Test Author'));
			expect(hasProfileName).toBe(true);
		}).toPass({ timeout: 15_000 });
	});
});

test.describe('Community page - general', () => {
	test('no critical JavaScript errors when navigating tabs', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));

		await navigateToCommunity(page);
		await clickNavTab(page, 'Learning');
		await page.waitForTimeout(2000);
		await clickNavTab(page, 'Chat');
		await page.waitForTimeout(2000);

		// Filter benign network errors
		const critical = errors.filter(
			(e) => !e.includes('WebSocket') && !e.includes('net::') && !e.includes('fetch')
		);
		expect(critical).toHaveLength(0);
	});
});
