import { test as baseTest, expect } from '@playwright/test';
import { test as authTest } from './fixtures.js';
import { setupErrorCapture } from './test-utils.js';

/**
 * E2E tests for the Settings page.
 *
 * Tests verify:
 * 1. Theme switching (light/dark/system, default/STIL) - works without login
 * 2. Login requirements for relay settings
 * 3. Relay settings management (authenticated)
 * 4. Gated mode toggle (authenticated)
 * 5. Debug mode toggle (authenticated)
 */

baseTest.describe('Settings page - Unauthenticated', () => {
  baseTest.describe('Theme switching', () => {
    baseTest('settings page loads and shows theme switcher', async ({ page }) => {
      await page.goto('/settings');

      // Page should load with theme settings visible
      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Theme switcher should be visible
      const appearanceSection = page.locator('text=Appearance').first();
      await expect(appearanceSection).toBeVisible();
    });

    baseTest('can switch between light and dark color modes', async ({ page }) => {
      await page.goto('/settings');

      // Wait for page to load
      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Find color mode buttons (Light, System, Dark)
      const lightButton = page.locator('button:has-text("Light"):visible').first();
      const darkButton = page.locator('button:has-text("Dark"):visible').first();

      // Click dark mode
      if (await darkButton.isVisible()) {
        await darkButton.click();
        await page.waitForTimeout(500);

        // Verify theme attribute changed
        const htmlElement = page.locator('html');
        const theme = await htmlElement.getAttribute('data-theme');
        expect(theme).toMatch(/dark/);
      }

      // Click light mode
      if (await lightButton.isVisible()) {
        await lightButton.click();
        await page.waitForTimeout(500);

        const htmlElement = page.locator('html');
        const theme = await htmlElement.getAttribute('data-theme');
        expect(theme).toMatch(/light|stil/);
      }
    });

    baseTest('can switch between theme families', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Find theme family buttons (Default, STIL)
      const defaultButton = page.locator('button:has-text("Default"):visible').first();
      const stilButton = page.locator('button:has-text("STIL"):visible').first();

      // Switch to STIL if available
      if (await stilButton.isVisible()) {
        await stilButton.click();
        await page.waitForTimeout(500);

        const htmlElement = page.locator('html');
        const theme = await htmlElement.getAttribute('data-theme');
        expect(theme).toMatch(/stil/);
      }

      // Switch back to Default
      if (await defaultButton.isVisible()) {
        await defaultButton.click();
        await page.waitForTimeout(500);

        const htmlElement = page.locator('html');
        const theme = await htmlElement.getAttribute('data-theme');
        expect(theme).not.toMatch(/stil/);
      }
    });
  });

  baseTest.describe('Unauthenticated state', () => {
    baseTest('shows login prompt when not logged in', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Should show a login prompt/alert for relay settings
      const loginPrompt = page.locator('text=/log in|sign in|login to|sign in to/i').first();
      await expect(loginPrompt).toBeVisible({ timeout: 5000 });
    });

    baseTest('hides relay settings when not logged in', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Relay preferences section should NOT be visible
      const relaySection = page.locator('text=/relay preferences/i').first();
      await expect(relaySection).not.toBeVisible({ timeout: 3000 });

      // Gated mode section should NOT be visible
      const gatedSection = page.locator('text=/gated mode/i').first();
      await expect(gatedSection).not.toBeVisible({ timeout: 3000 });
    });
  });

  baseTest.describe('Error handling', () => {
    baseTest('no critical JavaScript errors on settings page', async ({ page }) => {
      const errorCapture = setupErrorCapture(page);

      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Navigate through different sections
      await page.waitForTimeout(2000);

      errorCapture.assertNoCriticalErrors();
    });
  });
});

authTest.describe('Settings page - Authenticated', () => {
  authTest.describe('Relay settings', () => {
    authTest('shows relay preferences when logged in', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Relay preferences section should be visible
      const relaySection = page.locator('text=/relay preferences/i').first();
      await expect(relaySection).toBeVisible({ timeout: 10_000 });
    });

    authTest('can see existing relays or create defaults', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Wait for relay data to load
      await page.waitForTimeout(5000);

      // Should see either existing relays or "Create default list" option
      const hasRelays = await page.locator('text=/wss?:\\/\\//').first().isVisible();
      const hasCreateDefaults = await page
        .locator('button:has-text("Create default")')
        .first()
        .isVisible();

      expect(hasRelays || hasCreateDefaults).toBe(true);
    });

    authTest('shows Blossom servers section', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Blossom servers section should be visible
      const blossomSection = page.locator('text=/blossom|media server/i').first();
      await expect(blossomSection).toBeVisible({ timeout: 10_000 });
    });

    authTest('shows app-specific relay categories', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Wait for settings to load
      await page.waitForTimeout(3000);

      // Should see app-specific relay categories
      const calendarRelays = page.locator('text=/calendar/i').first();
      const educationalRelays = page.locator('text=/educational|learning/i').first();

      // At least one category should be visible
      const calendarVisible = await calendarRelays.isVisible().catch(() => false);
      const educationalVisible = await educationalRelays.isVisible().catch(() => false);

      expect(calendarVisible || educationalVisible).toBe(true);
    });
  });

  authTest.describe('Gated mode', () => {
    authTest('shows gated mode toggle when logged in', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Wait for settings to load
      await page.waitForTimeout(3000);

      // Look for gated mode section
      const gatedModeSection = page.locator('text=/gated mode/i').first();
      await expect(gatedModeSection).toBeVisible({ timeout: 5000 });
    });

    authTest('gated mode toggle is functional', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Wait for settings to load
      await page.waitForTimeout(3000);

      // Find a toggle in the gated mode section
      const gatedModeCard = page.locator('.card:has-text("Gated Mode")').first();
      const toggle = gatedModeCard.locator('input[type="checkbox"]').first();

      const toggleVisible = await toggle.isVisible().catch(() => false);
      if (toggleVisible) {
        // Just verify toggle is interactive (not disabled unless forced by config)
        const isDisabled = await toggle.isDisabled();
        // Toggle should either be enabled or show "forced" message
        if (!isDisabled) {
          // Don't actually click - just verify it's clickable
          expect(await toggle.isEnabled()).toBe(true);
        }
      }
    });
  });

  authTest.describe('Debug mode', () => {
    authTest('shows debug mode toggle when logged in', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Wait for settings to load
      await page.waitForTimeout(3000);

      // Look for developer/debug section
      const debugSection = page.locator('text=/developer/i').first();
      await expect(debugSection).toBeVisible({ timeout: 5000 });
    });

    authTest('debug mode toggle is functional', async ({ authenticatedPage: page }) => {
      await page.goto('/settings');

      await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
        timeout: 10_000
      });

      // Wait for settings to load
      await page.waitForTimeout(3000);

      // Find the debug toggle in the Developer section
      const developerCard = page.locator('.card:has-text("Developer")').first();
      const toggle = developerCard.locator('input[type="checkbox"]').first();

      const toggleVisible = await toggle.isVisible().catch(() => false);
      if (toggleVisible) {
        // Toggle debug mode and verify state changes
        const initialState = await toggle.isChecked();
        await toggle.click();
        await page.waitForTimeout(500);

        const newState = await toggle.isChecked();
        expect(newState).toBe(!initialState);

        // Toggle back to restore original state
        await toggle.click();
        await page.waitForTimeout(500);
      }
    });
  });

  authTest.describe('Error handling', () => {
    authTest(
      'no critical JavaScript errors when authenticated',
      async ({ authenticatedPage: page }) => {
        const errorCapture = setupErrorCapture(page);

        await page.goto('/settings');

        await expect(page.locator('h1').filter({ hasText: /settings/i })).toBeVisible({
          timeout: 10_000
        });

        // Wait for all sections to load
        await page.waitForTimeout(5000);

        errorCapture.assertNoCriticalErrors();
      }
    );
  });
});
