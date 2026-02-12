/**
 * Full E2E tests for AMB (Educational Resource) creation flow.
 *
 * These tests complete the entire creation wizard including:
 * - SKOS vocabulary selection (mocked via page.route)
 * - File uploads to Blossom server (port 3000)
 * - Event publication verification on amb-relay (port 7001)
 *
 * Prerequisites:
 * - Docker Compose running with amb-relay, blossom, and strfry
 * - Authenticated user via authenticatedPage fixture
 */

import {
  test,
  expect,
  openAMBCreationModal,
  setupSKOSMocks,
  clearSKOSCache,
  completeAMBStep1,
  completeAMBStep2,
  completeAMBStep3,
  completeAMBStep4
} from './fixtures.js';
import { setupErrorCapture } from './test-utils.js';
import { TEST_COMMUNITY, TEST_AUTHOR } from './test-data.js';
import { verifyAMBResourceOnRelay } from './relay-verification.js';

// ============================================================================
// Full Creation Flow Tests
// ============================================================================

test.describe('AMB Resource Creation - Full Flow', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Setup SKOS mocks BEFORE any navigation
    await setupSKOSMocks(page);
  });

  test('completes full creation flow with required fields', async ({ authenticatedPage: page }) => {
    const uniqueTitle = `E2E Full Flow Test ${Date.now()}`;

    // Clear SKOS cache to ensure fresh mock data
    await page.goto('/');
    await clearSKOSCache(page);

    // Open the AMB creation modal
    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    // Step 1: Basic Info
    await completeAMBStep1(page, {
      title: uniqueTitle,
      description: 'Full creation flow test for E2E testing'
    });

    // Step 2: Classification (SKOS dropdowns with mocked data)
    await completeAMBStep2(page);

    // Step 3: Creators (auto-filled with logged-in user)
    await completeAMBStep3(page);

    // Step 4: License & Publish
    await completeAMBStep4(page);

    // Should navigate to the new resource page (naddr route)
    await expect(page).toHaveURL(/\/naddr1/, { timeout: 20000 });

    // Verify page shows the resource title
    await expect(page.locator(`text=${uniqueTitle}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('published event appears on amb-relay', async ({ authenticatedPage: page }) => {
    const uniqueTitle = `E2E Relay Verify ${Date.now()}`;

    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page, { title: uniqueTitle, description: 'Relay verification test' });
    await completeAMBStep2(page);
    await completeAMBStep3(page);
    await completeAMBStep4(page);

    // Wait for navigation to confirm publish succeeded
    await expect(page).toHaveURL(/\/naddr1/, { timeout: 20000 });

    // Verify the event appears on amb-relay
    const event = await verifyAMBResourceOnRelay(
      {
        author: TEST_AUTHOR.pubkey,
        title: uniqueTitle
      },
      15000
    );

    expect(event).toBeDefined();
    expect(event.kind).toBe(30142);

    // Verify required tags exist
    const nameTag = event.tags.find((t) => t[0] === 'name');
    expect(nameTag?.[1]).toBe(uniqueTitle);

    const resourceTypeTag = event.tags.find((t) => t[0] === 'learningResourceType.id');
    expect(resourceTypeTag).toBeDefined();
    expect(resourceTypeTag?.[1]).toContain('w3id.org/kim/hcrt');

    const subjectTag = event.tags.find((t) => t[0] === 'about.id');
    expect(subjectTag).toBeDefined();
  });

  test('published event has correct metadata tags', async ({ authenticatedPage: page }) => {
    const uniqueTitle = `E2E Metadata Test ${Date.now()}`;
    const description = 'Testing that all AMB metadata is correctly included';

    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page, {
      title: uniqueTitle,
      description: description,
      language: 'en'
    });
    await completeAMBStep2(page, { resourceType: 'Text', subject: 'Computer Science' });
    await completeAMBStep3(page);
    await completeAMBStep4(page);

    await expect(page).toHaveURL(/\/naddr1/, { timeout: 20000 });

    const event = await verifyAMBResourceOnRelay(
      { author: TEST_AUTHOR.pubkey, title: uniqueTitle },
      15000
    );

    // Verify all expected tags
    expect(event.tags.find((t) => t[0] === 'name')?.[1]).toBe(uniqueTitle);
    expect(event.tags.find((t) => t[0] === 'description')?.[1]).toBe(description);
    expect(event.tags.find((t) => t[0] === 'inLanguage')?.[1]).toBe('en');
    expect(event.tags.find((t) => t[0] === 'license.id')).toBeDefined();

    // Verify content field matches description
    expect(event.content).toBe(description);
  });
});

// ============================================================================
// SKOS Dropdown Tests (with mocks)
// ============================================================================

test.describe('AMB Resource Creation - SKOS Dropdowns', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupSKOSMocks(page);
  });

  test('SKOS dropdown shows mocked resource type options', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);

    // Wait for step 2 and SKOS data to load
    await expect(page.locator('text=Resource Type').first()).toBeVisible({ timeout: 10000 });

    // Open the Resource Type dropdown
    const dropdown = page.locator('.dropdown').filter({ hasText: 'Resource Type' }).first();
    await dropdown.locator('button').first().click();
    await page.waitForTimeout(500);

    // Verify mocked options are visible
    await expect(page.locator('.dropdown-content button:has-text("Text")')).toBeVisible();
    await expect(page.locator('.dropdown-content button:has-text("Video")')).toBeVisible();
    await expect(page.locator('.dropdown-content button:has-text("Audio")')).toBeVisible();
  });

  test('SKOS dropdown shows mocked subject options', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);

    // Wait for step 2
    await expect(page.locator('text=Subject').first()).toBeVisible({ timeout: 10000 });

    // Open the Subject dropdown
    const dropdown = page.locator('.dropdown').filter({ hasText: 'Subject' }).first();
    await dropdown.locator('button').first().click();
    await page.waitForTimeout(500);

    // Verify mocked options are visible (including nested ones)
    await expect(
      page.locator('.dropdown-content button:has-text("Computer Science")').first()
    ).toBeVisible();
    await expect(
      page.locator('.dropdown-content button:has-text("Mathematics")').first()
    ).toBeVisible();
  });

  test('can select multiple resource types', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);

    await expect(page.locator('text=Resource Type').first()).toBeVisible({ timeout: 10000 });

    // Open dropdown and select Text
    const dropdown = page.locator('.dropdown').filter({ hasText: 'Resource Type' }).first();
    await dropdown.locator('button').first().click();
    await page.waitForTimeout(300);
    await page.locator('.dropdown-content button:has-text("Text")').first().click();

    // Should show badge
    await expect(dropdown.locator('.badge:has-text("Text")')).toBeVisible();

    // Select another option (Video)
    await dropdown.locator('button').first().click();
    await page.waitForTimeout(300);
    await page.locator('.dropdown-content button:has-text("Video")').first().click();

    // Should show both badges
    await expect(dropdown.locator('.badge:has-text("Text")')).toBeVisible();
    await expect(dropdown.locator('.badge:has-text("Video")')).toBeVisible();
  });
});

// ============================================================================
// File Upload Tests
// ============================================================================

test.describe('AMB Resource Creation - File Upload', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupSKOSMocks(page);
  });

  test('can upload file to Blossom server', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);
    await completeAMBStep2(page);

    // Now on step 3 - wait for BlossomUploader
    await expect(page.locator('.blossom-uploader')).toBeVisible({ timeout: 10000 });

    // Setup file chooser handler
    const fileChooserPromise = page.waitForEvent('filechooser');

    // Click the drop zone to trigger file input
    await page.locator('.blossom-uploader [role="button"]').click();

    // Handle file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Test PDF content for E2E testing')
    });

    // Wait for upload to complete - file name should appear
    await expect(page.locator('.blossom-uploader').getByText('test-document.pdf')).toBeVisible({
      timeout: 30000
    });
  });

  test('uploaded file appears in file list', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);
    await completeAMBStep2(page);

    await expect(page.locator('.blossom-uploader')).toBeVisible({ timeout: 10000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.blossom-uploader [role="button"]').click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: 'my-resource.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Educational content goes here')
    });

    // Verify file appears in the uploaded files list
    await expect(page.locator('.blossom-uploader').getByText('my-resource.txt')).toBeVisible({
      timeout: 30000
    });

    // Verify remove button is present
    const fileEntry = page
      .locator('.blossom-uploader')
      .locator('text=my-resource.txt')
      .locator('..');
    await expect(fileEntry.locator('button').first()).toBeVisible();
  });

  test('can remove uploaded file', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);
    await completeAMBStep2(page);

    await expect(page.locator('.blossom-uploader')).toBeVisible({ timeout: 10000 });

    // Upload a file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.blossom-uploader [role="button"]').click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: 'to-be-removed.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('This will be removed')
    });

    await expect(page.locator('.blossom-uploader').getByText('to-be-removed.pdf')).toBeVisible({
      timeout: 30000
    });

    // Find and click the remove button for this file
    await page
      .locator('.blossom-uploader')
      .locator('li')
      .filter({ hasText: 'to-be-removed.pdf' })
      .locator('button')
      .click();

    // File should no longer be visible
    await expect(page.locator('.blossom-uploader').getByText('to-be-removed.pdf')).not.toBeVisible({
      timeout: 5000
    });
  });

  test('full creation with file upload includes encoding tag', async ({
    authenticatedPage: page
  }) => {
    const uniqueTitle = `E2E With File ${Date.now()}`;

    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page, { title: uniqueTitle, description: 'Test with file upload' });
    await completeAMBStep2(page);

    // Upload file on step 3
    await expect(page.locator('.blossom-uploader')).toBeVisible({ timeout: 10000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.blossom-uploader [role="button"]').click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: 'educational-content.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Educational PDF content for testing')
    });

    await expect(
      page.locator('.blossom-uploader').getByText('educational-content.pdf')
    ).toBeVisible({ timeout: 30000 });

    // Continue to step 4 and publish
    await completeAMBStep3(page);
    await completeAMBStep4(page);

    await expect(page).toHaveURL(/\/naddr1/, { timeout: 20000 });

    // Verify the event has encoding tags
    const event = await verifyAMBResourceOnRelay(
      { author: TEST_AUTHOR.pubkey, title: uniqueTitle },
      15000
    );

    // Check for encoding tag (file URL from Blossom)
    const encodingTag = event.tags.find((t) => t[0] === 'encoding.contentUrl');
    expect(encodingTag).toBeDefined();
    expect(encodingTag?.[1]).toContain('http'); // Blossom URL
  });
});

// ============================================================================
// Keywords and External URLs Tests
// ============================================================================

test.describe('AMB Resource Creation - Keywords and URLs', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupSKOSMocks(page);
  });

  test('can add keywords in step 2', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);

    // Wait for step 2
    await expect(page.locator('text=Resource Type').first()).toBeVisible({ timeout: 10000 });

    // Find keywords input
    const keywordsInput = page
      .locator('input[placeholder*="keyword"]')
      .or(page.locator('#amb-keywords'));

    // Add keywords
    await keywordsInput.fill('education');
    await keywordsInput.press('Enter');
    await page.waitForTimeout(300);

    await keywordsInput.fill('learning');
    await keywordsInput.press('Enter');
    await page.waitForTimeout(300);

    // Verify keywords appear as badges
    await expect(page.locator('.badge:has-text("education")')).toBeVisible();
    await expect(page.locator('.badge:has-text("learning")')).toBeVisible();
  });

  test('can add external URLs in step 3', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);
    await completeAMBStep2(page);

    // Now on step 3 - wait for external URL input
    await expect(page.locator('text=External').first()).toBeVisible({ timeout: 10000 });

    // Find URL input
    const urlInput = page
      .locator('input[placeholder*="URL"]')
      .or(page.locator('input[placeholder*="https://"]'))
      .first();

    // Add URL
    await urlInput.fill('https://example.com/resource');
    await urlInput.press('Enter');
    await page.waitForTimeout(300);

    // Verify URL appears in list
    await expect(page.locator('text=example.com/resource').first()).toBeVisible();
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('AMB Resource Creation - Error Handling', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupSKOSMocks(page);
  });

  test('no critical JavaScript errors during full creation flow', async ({
    authenticatedPage: page
  }) => {
    const errorCapture = setupErrorCapture(page);

    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page, { title: `Error Check ${Date.now()}` });
    await completeAMBStep2(page);
    await completeAMBStep3(page);
    await completeAMBStep4(page);

    await expect(page).toHaveURL(/\/naddr1/, { timeout: 20000 });

    errorCapture.assertNoCriticalErrors();
  });

  test('shows error when SKOS selection is missing', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page);

    // On step 2, try to proceed without selecting SKOS values
    // Wait for SKOS dropdowns to load
    await expect(page.locator('text=Resource Type').first()).toBeVisible({ timeout: 10000 });

    // Click Next without selecting anything
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Should still be on step 2 (validation blocked)
    await expect(page.locator('text=Resource Type').first()).toBeVisible();
  });
});

// ============================================================================
// Navigation and UI Tests
// ============================================================================

test.describe('AMB Resource Creation - Navigation', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupSKOSMocks(page);
  });

  test('resource visible on community Learning tab after creation', async ({
    authenticatedPage: page
  }) => {
    const uniqueTitle = `E2E Tab Verify ${Date.now()}`;

    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);
    await completeAMBStep1(page, { title: uniqueTitle, description: 'Tab verification test' });
    await completeAMBStep2(page);
    await completeAMBStep3(page);
    await completeAMBStep4(page);

    await expect(page).toHaveURL(/\/naddr1/, { timeout: 20000 });

    // Navigate back to community Learning tab
    await page.goto(`/c/${TEST_COMMUNITY.npub}`);
    await page.waitForTimeout(2000);

    await page.locator('nav.menu button', { hasText: 'Learning' }).click();
    await page.waitForTimeout(3000);

    // The newly created resource should appear in the list
    await expect(page.locator(`text=${uniqueTitle}`).first()).toBeVisible({ timeout: 15000 });
  });

  test('back button preserves form state on step 2', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await clearSKOSCache(page);

    await openAMBCreationModal(page, TEST_COMMUNITY.npub);

    const testTitle = 'Preserved Title Test';
    await page.locator('#amb-title').fill(testTitle);
    await page.locator('#amb-description').fill('Test description');
    await page.locator('#amb-language').selectOption('en');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Now on step 2
    await expect(page.locator('text=Resource Type').first()).toBeVisible({ timeout: 10000 });

    // Go back to step 1
    await page.locator('button:has-text("Back")').click();
    await page.waitForTimeout(500);

    // Title should be preserved
    await expect(page.locator('#amb-title')).toHaveValue(testTitle);
  });
});
