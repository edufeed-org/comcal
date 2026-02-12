import { test as base, expect } from '@playwright/test';
import { TEST_AUTHOR } from './test-data.js';
import {
  MOCK_HCRT_VOCABULARY,
  MOCK_SUBJECTS_VOCABULARY,
  MOCK_END_USER_ROLE_VOCABULARY
} from './mock-skos-data.js';

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
 * Helper to logout the current user.
 * Clicks the profile dropdown and logs out.
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Navigate to a page without overlapping hero elements
  await page.goto('/discover');
  await page.waitForTimeout(2000);

  // Click the profile avatar button to open dropdown
  await page.locator('.dropdown .btn-circle').click();

  // Wait for dropdown to open
  await page.waitForTimeout(300);

  // Click the logout button (contains "Logout" or similar text)
  await page
    .locator('.dropdown-content button')
    .filter({ hasText: /logout|abmelden/i })
    .first()
    .click();

  // Wait for logout to complete - login button should reappear
  await expect(page.locator('button:has-text("Login")')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to login with an nsec.
 * @param {import('@playwright/test').Page} page
 * @param {string} nsec - The nsec to login with
 */
export async function loginWithNsec(page, nsec) {
  // Click the login button in navbar
  await page.locator('button:has-text("Login")').first().click();

  // Wait for login modal to appear
  await expect(page.locator('#global-login-modal')).toBeVisible({ timeout: 5000 });

  // Click NSEC login option
  await page.locator('#global-login-modal button:has-text("NSEC")').click();

  // Wait for NSEC input modal to appear
  await expect(page.locator('#global-private-key-modal')).toBeVisible({ timeout: 5000 });

  // Find and fill the nsec input
  const nsecInput = page.locator('#global-private-key-modal input').first();
  await nsecInput.fill(nsec);

  // Click the login button
  await page.locator('#global-private-key-modal button.btn-primary').click();

  // Wait for login to complete
  await page.waitForTimeout(1500);

  // Close any open modal
  for (let i = 0; i < 3; i++) {
    const hasOpenModal = await page.locator('dialog[open]').isVisible();
    if (hasOpenModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }
}

/**
 * Helper to open the event creation modal on the calendar page.
 * Clicks the FAB and then the "Create Event" button.
 * @param {import('@playwright/test').Page} page
 */
export async function openEventCreationModal(page) {
  // Navigate to calendar page
  await page.goto('/calendar');
  await page.waitForTimeout(2000);

  // Click the FAB to expand it (the main button with role="button")
  await page.locator('.fab [role="button"]').click();
  await page.waitForTimeout(300);

  // Click the "Create Event" button
  await page.locator('button[data-tip="Create Event"]').click();

  // Wait for modal to appear
  await expect(page.locator('dialog[open] .modal-box')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to open the AMB resource creation modal on a community's Learning tab.
 * Navigates to the community, clicks the FAB, and opens the creation modal.
 * @param {import('@playwright/test').Page} page
 * @param {string} communityNpub - The community's npub (bech32)
 */
export async function openAMBCreationModal(page, communityNpub) {
  // Navigate to community page
  await page.goto(`/c/${communityNpub}`);
  await page.waitForTimeout(2000);

  // Wait for community sidebar to load
  await expect(page.locator('nav.menu').first()).toBeVisible({ timeout: 15000 });

  // Click on Learning tab using nav.menu button selector (matches community.test.js)
  await page.locator('nav.menu button', { hasText: 'Learning' }).click();
  await page.waitForTimeout(2000);

  // Wait for FAB to be visible (always present on Learning tab for authenticated users)
  await expect(page.locator('.fab').first()).toBeVisible({ timeout: 15000 });

  // Click the FAB to expand it (use first() for mobile/desktop FAB)
  await page.locator('.fab [role="button"]').first().click();
  await page.waitForTimeout(300);

  // Click the "Create Learning Content" button
  await page.locator('button[data-tip="Create Learning Content"]').first().click();

  // Wait for modal to appear (it's a native dialog element)
  await expect(page.locator('dialog[open] .modal-box')).toBeVisible({ timeout: 5000 });
}

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

// ============================================================================
// SKOS Mock Helpers
// ============================================================================

/**
 * Setup SKOS vocabulary mocks using Playwright route interception.
 * IMPORTANT: Must be called BEFORE navigating to pages that use SKOSDropdown.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function setupSKOSMocks(page) {
  // Mock learning resource types vocabulary
  await page.route('**/w3id.org/kim/hcrt/scheme.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_HCRT_VOCABULARY)
    });
  });

  // Mock subjects vocabulary
  await page.route('**/w3id.org/kim/hochschulfaechersystematik/scheme.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SUBJECTS_VOCABULARY)
    });
  });

  // Mock intended end user role vocabulary (optional, may not be used)
  await page.route('**/w3id.org/kim/intendedEndUserRole/scheme.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_END_USER_ROLE_VOCABULARY)
    });
  });
}

/**
 * Clear SKOS vocabulary cache from localStorage.
 * Useful to ensure fresh mock data is fetched.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function clearSKOSCache(page) {
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('skos_vocab_'))
      .forEach((k) => localStorage.removeItem(k));
  });
}

// ============================================================================
// AMB Creation Step Helpers
// ============================================================================

/**
 * Complete AMB wizard Step 1 (Basic Info).
 * Fills the title, description, and language fields.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [data] - Form data
 * @param {string} [data.title] - Resource title (default: 'Test Educational Resource')
 * @param {string} [data.description] - Description (default: 'Test description for E2E')
 * @param {string} [data.language] - Language code (default: 'en')
 * @param {string} [data.identifier] - Optional URL identifier
 * @param {string} [data.image] - Optional image URL
 */
export async function completeAMBStep1(page, data = {}) {
  const title = data.title || 'Test Educational Resource';
  const description = data.description || 'Test description for E2E testing';
  const language = data.language || 'en';

  await page.locator('#amb-title').fill(title);
  await page.locator('#amb-description').fill(description);
  await page.locator('#amb-language').selectOption(language);

  if (data.identifier) {
    await page.locator('#amb-identifier').fill(data.identifier);
  }

  if (data.image) {
    await page.locator('#amb-image').fill(data.image);
  }

  // Click Next to advance to step 2
  await page.locator('button:has-text("Next")').click();
  await page.waitForTimeout(500);
}

/**
 * Complete AMB wizard Step 2 (Classification).
 * Selects resource type and subject from SKOS dropdowns.
 * Requires SKOS mocks to be set up via setupSKOSMocks().
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [data] - Selection data
 * @param {string} [data.resourceType] - Resource type label (default: 'Text')
 * @param {string} [data.subject] - Subject label (default: 'Computer Science')
 * @param {string[]} [data.keywords] - Keywords to add
 */
export async function completeAMBStep2(page, data = {}) {
  const resourceType = data.resourceType || 'Text';
  const subject = data.subject || 'Computer Science';

  // Wait for SKOS dropdowns to load (they fetch on mount)
  await expect(page.locator('text=Resource Type').first()).toBeVisible({ timeout: 10000 });

  // Click Resource Type dropdown trigger
  const resourceTypeDropdown = page
    .locator('.dropdown')
    .filter({ hasText: 'Resource Type' })
    .first();
  await resourceTypeDropdown.locator('button').first().click();
  await page.waitForTimeout(300);

  // Select the resource type option
  await page.locator(`.dropdown-content button:has-text("${resourceType}")`).first().click();
  await page.waitForTimeout(300);

  // Click outside to close dropdown
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.waitForTimeout(200);

  // Click Subject dropdown trigger
  const subjectDropdown = page.locator('.dropdown').filter({ hasText: 'Subject' }).first();
  await subjectDropdown.locator('button').first().click();
  await page.waitForTimeout(300);

  // Select the subject option
  await page.locator(`.dropdown-content button:has-text("${subject}")`).first().click();
  await page.waitForTimeout(300);

  // Click outside to close dropdown
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.waitForTimeout(200);

  // Add keywords if provided
  if (data.keywords && data.keywords.length > 0) {
    const keywordsInput = page
      .locator('input[placeholder*="keyword"]')
      .or(page.locator('#amb-keywords'));
    for (const keyword of data.keywords) {
      await keywordsInput.fill(keyword);
      await keywordsInput.press('Enter');
      await page.waitForTimeout(200);
    }
  }

  // Click Next to advance to step 3
  await page.locator('button:has-text("Next")').click();
  await page.waitForTimeout(500);
}

/**
 * Complete AMB wizard Step 3 (Content & Creators).
 * The creator is auto-filled with the logged-in user.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [data] - Step data
 * @param {string[]} [data.externalUrls] - External URLs to add
 */
export async function completeAMBStep3(page, data = {}) {
  // Wait for step 3 to load
  await expect(page.locator('text=Creators').or(page.locator('text=External'))).toBeVisible({
    timeout: 5000
  });

  // Add external URLs if provided
  if (data.externalUrls && data.externalUrls.length > 0) {
    const urlInput = page
      .locator('input[placeholder*="URL"]')
      .or(page.locator('input[placeholder*="https://"]'));
    for (const url of data.externalUrls) {
      await urlInput.fill(url);
      await urlInput.press('Enter');
      await page.waitForTimeout(200);
    }
  }

  // Click Next to advance to step 4
  await page.locator('button:has-text("Next")').click();
  await page.waitForTimeout(500);
}

/**
 * Complete AMB wizard Step 4 (License & Publish).
 * Selects license and clicks publish.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [data] - Step data
 * @param {string} [data.license] - License value (default: CC BY 4.0)
 * @param {boolean} [data.freeAccess] - Whether to check free access (default: true)
 */
export async function completeAMBStep4(page, data = {}) {
  // Wait for step 4 to load
  await expect(page.locator('#amb-license').or(page.locator('text=License'))).toBeVisible({
    timeout: 5000
  });

  // Select license if different from default
  if (data.license) {
    await page.locator('#amb-license').selectOption(data.license);
  }

  // Free access checkbox (usually checked by default)
  if (data.freeAccess !== undefined) {
    const checkbox = page
      .locator('#amb-free-access')
      .or(page.locator('input[type="checkbox"]').first());
    const isChecked = await checkbox.isChecked();
    if (data.freeAccess !== isChecked) {
      await checkbox.click();
    }
  }

  // Click Publish to submit
  await page.locator('button:has-text("Publish Resource")').click();
}
