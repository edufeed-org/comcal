/**
 * E2E tests for chat message posting in community pages.
 *
 * Tests the chat input visibility for authenticated/unauthenticated users
 * and the full message posting flow.
 */
import { test as baseTest, expect } from '@playwright/test';
import { test } from './fixtures.js';
import { TEST_COMMUNITY } from './test-data.js';
import { waitForCommunitySidebar, setupErrorCapture } from './test-utils.js';

const COMMUNITY_URL = `/c/${TEST_COMMUNITY.npub}`;

/**
 * Navigate to community page and click the Chat tab.
 * @param {import('@playwright/test').Page} page
 */
async function navigateToChatTab(page) {
  await page.goto(COMMUNITY_URL);
  await waitForCommunitySidebar(page);
  await page.waitForTimeout(500);

  // Click Chat tab in nav menu
  await page.locator('nav.menu button', { hasText: 'Chat' }).click();

  // Wait for chat container to load
  await expect(page.locator('.chat, [class*="chat"]').first()).toBeVisible({ timeout: 30_000 });
}

// ============================================================================
// Unauthenticated Tests
// ============================================================================

baseTest.describe('Chat Posting - Unauthenticated', () => {
  baseTest('chat input is hidden for unauthenticated users', async ({ page }) => {
    await navigateToChatTab(page);

    // Login prompt should be visible instead of input
    await expect(page.getByText(/login|anmelden/i)).toBeVisible({ timeout: 5000 });

    // Chat input should NOT be visible
    const input = page.locator('input[placeholder*="message"], textarea');
    await expect(input).not.toBeVisible();
  });

  baseTest('send button is not visible for unauthenticated users', async ({ page }) => {
    await navigateToChatTab(page);

    // Send button should not be visible
    const sendButton = page.locator('button[type="submit"]').filter({ hasText: /send|senden/i });
    await expect(sendButton).not.toBeVisible();
  });
});

// ============================================================================
// Authenticated Tests
// ============================================================================

test.describe('Chat Posting - Authenticated', () => {
  test('chat input is visible for authenticated users', async ({ authenticatedPage: page }) => {
    await navigateToChatTab(page);

    // Input should be visible - chat uses input[type="text"][required]
    const input = page.locator('input[type="text"][required]');
    await expect(input.first()).toBeVisible({ timeout: 10_000 });
  });

  test('send button is visible for authenticated users', async ({ authenticatedPage: page }) => {
    await navigateToChatTab(page);

    // Send button should be visible
    const sendButton = page.locator('button[type="submit"]');
    await expect(sendButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('can type message in chat input', async ({ authenticatedPage: page }) => {
    await navigateToChatTab(page);

    // Find input and type a message
    const input = page.locator('input[type="text"]').first();
    await input.fill('Test message from E2E');

    // Verify the input value
    await expect(input).toHaveValue('Test message from E2E');
  });

  test('send button is disabled when input is empty', async ({ authenticatedPage: page }) => {
    await navigateToChatTab(page);

    // Ensure input is empty
    const input = page.locator('input[type="text"]').first();
    await input.clear();

    // Send button should be disabled
    const sendButton = page.locator('button[type="submit"]');
    await expect(sendButton.first()).toBeDisabled();
  });

  test('can send message and see it appear in chat', async ({ authenticatedPage: page }) => {
    await navigateToChatTab(page);

    // Generate unique message content
    const messageContent = `E2E test message ${Date.now()}`;

    // Fill input and send by pressing Enter (more reliable for form submission)
    const input = page.locator('form input[type="text"]').first();
    await input.fill(messageContent);
    await input.press('Enter');

    // Input should be cleared after sending (optimistic UI)
    await expect(input).toHaveValue('', { timeout: 5000 });

    // Message should appear in chat (optimistic UI adds it immediately)
    await expect(page.locator('.chat-bubble').filter({ hasText: messageContent })).toBeVisible({
      timeout: 10_000
    });
  });

  test('sent message appears with correct styling for own message', async ({
    authenticatedPage: page
  }) => {
    await navigateToChatTab(page);

    // Send a message by pressing Enter
    const messageContent = `My own message ${Date.now()}`;
    const input = page.locator('form input[type="text"]').first();
    await input.fill(messageContent);
    await input.press('Enter');

    // Wait for message to appear
    await expect(page.locator('.chat-bubble').filter({ hasText: messageContent })).toBeVisible({
      timeout: 10_000
    });

    // Own messages should have chat-end styling
    const chatContainer = page.locator('.chat').filter({ hasText: messageContent });
    await expect(chatContainer).toHaveClass(/chat-end/);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Chat Posting - Error Handling', () => {
  test('no critical JavaScript errors during chat interaction', async ({
    authenticatedPage: page
  }) => {
    const errorCapture = setupErrorCapture(page);

    await navigateToChatTab(page);

    // Type and send a message by pressing Enter
    const input = page.locator('form input[type="text"]').first();
    await input.fill('Test message');
    await input.press('Enter');

    // Wait for message to appear
    await page.waitForTimeout(2000);

    // Assert no critical errors
    errorCapture.assertNoCriticalErrors();
  });
});
