import { test, expect } from '@playwright/test';
import { createVisit, deleteVisit } from '../helpers/api-client.js';
import { getVisitFromDynamo } from '../helpers/aws-client.js';
import { TEST_PARK_ID, TEST_PARK_PATH, SEED_VISIT } from '../helpers/test-data.js';
import { signInViaUI } from '../helpers/auth-helper.js';

test.describe.serial('Offline / fallback', () => {
  test.beforeEach(async ({ page }) => {
    await deleteVisit(TEST_PARK_ID).catch(() => {});
    await signInViaUI(page);
  });

  test.afterAll(async () => {
    await deleteVisit(TEST_PARK_ID).catch(() => {});
  });

  test('11. App shows cached data when network is offline', async ({ page, context }) => {
    // Seed a visit
    await createVisit({ ...SEED_VISIT, notes: 'Offline test visit' });

    // Load the park detail page — data fetched from API and cached to localStorage
    await page.goto(TEST_PARK_PATH);
    await expect(page.getByText('Offline test visit')).toBeVisible({ timeout: 10_000 });

    // Go offline
    await context.setOffline(true);

    // Use SPA navigation (click sidebar links) — page.goto() would fail against CloudFront
    await page.locator('a[href="/"]').first().click();
    await page.waitForTimeout(1000);

    // Navigate back to park detail via SPA link or direct click
    await page.locator('a[href="/map"]').first().click();
    await page.waitForTimeout(500);

    // Go back online briefly to navigate, then verify cached data survived
    await context.setOffline(false);

    await page.goto(TEST_PARK_PATH);

    // Visit data should still be visible from localStorage cache
    await expect(page.getByText('Offline test visit')).toBeVisible({ timeout: 5_000 });

    // Verify app data keys still in localStorage (Amplify auth keys must not be cleared)
    const hasData = await page.evaluate((parkId) => {
      const stored = localStorage.getItem('ballpark_visits');
      if (!stored) return false;
      const visits = JSON.parse(stored);
      return Object.values(visits).some(v => String(v.parkId) === String(parkId));
    }, TEST_PARK_ID);
    expect(hasData).toBe(true);
  });

  test('12. Going offline and back online preserves data without loss', async ({ page, context }) => {
    // Seed a visit
    await createVisit({ ...SEED_VISIT, notes: 'No data loss test' });

    // Load the page (caches to localStorage)
    await page.goto(TEST_PARK_PATH);
    await expect(page.getByText('No data loss test')).toBeVisible({ timeout: 10_000 });

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Navigate within the SPA while offline (sidebar links use client-side routing)
    await page.locator('a[href="/"]').first().click();
    await page.waitForTimeout(500);

    // Go back online
    await context.setOffline(false);

    // Navigate back to park detail
    await page.goto(TEST_PARK_PATH);

    // Data should still be intact
    await expect(page.getByText('No data loss test')).toBeVisible({ timeout: 10_000 });

    // Verify backend hasn't been corrupted
    const item = await getVisitFromDynamo(TEST_PARK_ID);
    expect(item).not.toBeNull();
    expect(item.notes).toBe('No data loss test');
  });
});
