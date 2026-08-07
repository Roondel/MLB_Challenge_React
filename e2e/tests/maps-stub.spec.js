import { test, expect } from '@playwright/test';
import { mockRouteMatrixApi } from '../helpers/mock-route-api.js';

// These tests validate that the client never talks to Google directly.
// They do NOT require the domain to be live — they run against E2E_BASE_URL.
// They verify no real Google Maps API calls are made from the browser (the
// app is designed so Google is only ever called server-side, from the
// mlb-route Lambda — see CLAUDE.md). /api/route itself is mocked here too,
// regardless of the deployed VITE_USE_REAL_MAPS value, so this suite never
// spends real Google Maps quota through the Lambda either.

test.describe('Google Maps client-side isolation', () => {
  let googleMapsRequests = [];

  test.beforeEach(async ({ page }) => {
    googleMapsRequests = [];

    // Intercept and record any calls to Google Maps APIs
    page.on('request', request => {
      if (request.url().includes('maps.googleapis.com')) {
        googleMapsRequests.push(request.url());
      }
    });

    await mockRouteMatrixApi(page);

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
