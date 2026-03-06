import { test, expect } from '@playwright/test';

// These tests validate the Google Maps stub behaviour.
// They do NOT require the domain to be live — they run against E2E_BASE_URL.
// They verify no real Google Maps API calls are made when VITE_USE_REAL_MAPS=false.

test.describe('Google Maps stub (VITE_USE_REAL_MAPS=false)', () => {
  let googleMapsRequests = [];

  test.beforeEach(async ({ page }) => {
    googleMapsRequests = [];

    // Intercept and record any calls to Google Maps APIs
    page.on('request', request => {
      if (request.url().includes('maps.googleapis.com')) {
        googleMapsRequests.push(request.url());
      }
    });

    // Sign in before navigating to trip planner
    const { signInViaUI } = await import('../helpers/auth-helper.js');
    await signInViaUI(page);
  });

  test('1. Trip planner loads without calling maps.googleapis.com', async ({ page }) => {
    await page.goto('/trip', { waitUntil: 'networkidle' });

    // Trip planner page renders
    await expect(page.locator('h1, h2').filter({ hasText: /trip/i })).toBeVisible({ timeout: 10_000 });

    // No Google Maps API calls made
    expect(googleMapsRequests).toHaveLength(0);
  });

  test('2. No requests to maps.googleapis.com during trip planner interaction', async ({ page }) => {
    await page.goto('/trip', { waitUntil: 'networkidle' });

    // Interact with trip planner if parks can be selected
    const parkCheckboxes = page.locator('[data-testid*="park-select"]');
    const count = await parkCheckboxes.count();
    if (count > 0) {
      await parkCheckboxes.first().click();
    }

    // Still no Google Maps calls
    expect(googleMapsRequests).toHaveLength(0);
  });
});
