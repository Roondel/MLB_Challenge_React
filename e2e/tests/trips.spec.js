import { test, expect } from '@playwright/test';
import { createTrip, deleteTrip } from '../helpers/api-client.js';
import { getTripFromDynamo, waitForTripDeletion } from '../helpers/aws-client.js';
import { SEED_TRIP } from '../helpers/test-data.js';
import { signInViaUI } from '../helpers/auth-helper.js';

const TRIP_ID = 'e2e-test-trip-001';

test.describe.serial('Trips — save, load, delete', () => {
  test.beforeEach(async ({ page }) => {
    await deleteTrip(TRIP_ID).catch(() => {});
    await signInViaUI(page);
  });

  test.afterAll(async () => {
    await deleteTrip(TRIP_ID).catch(() => {});
  });

  test('8. Saving a trip creates a DynamoDB record', async ({ page }) => {
    // Seed a trip via API (bypasses the MLB schedule search for reliability)
    const tripData = { ...SEED_TRIP, tripId: TRIP_ID };
    await createTrip(tripData);

    // Navigate to trip planner
    await page.goto('/trip');

    // The saved trips section should show our trip
    await expect(page.getByText('E2E Test Trip')).toBeVisible({ timeout: 10_000 });

    // Verify backend — DynamoDB should have the record
    const item = await getTripFromDynamo(TRIP_ID);
    expect(item).not.toBeNull();
    expect(item.name || item.tripId).toBeTruthy();
  });

  test('9. Saved trips persist across page reload via API', async ({ page }) => {
    // Seed trip
    await createTrip({ ...SEED_TRIP, tripId: TRIP_ID });

    await page.goto('/trip');
    await expect(page.getByText('E2E Test Trip')).toBeVisible({ timeout: 10_000 });

    // Clear only app data keys — Amplify auth keys must survive for re-auth to work
    await page.evaluate(() => {
      localStorage.removeItem('ballpark_visits');
      localStorage.removeItem('ballpark_trips');
    });

    // Reload
    await page.reload();

    // Trip should still appear — loaded from API
    await expect(page.getByText('E2E Test Trip')).toBeVisible({ timeout: 10_000 });
  });

  test('10. Deleting a trip removes it from DynamoDB', async ({ page }) => {
    // Seed trip
    await createTrip({ ...SEED_TRIP, tripId: TRIP_ID });

    await page.goto('/trip');
    await expect(page.getByText('E2E Test Trip')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('delete-trip').click();

    // Wait for the trip to disappear from UI
    await expect(page.getByText('E2E Test Trip')).not.toBeVisible({ timeout: 10_000 });

    // Wait for async API delete to propagate to DynamoDB
    await waitForTripDeletion(TRIP_ID);

    // Verify backend
    const item = await getTripFromDynamo(TRIP_ID);
    expect(item).toBeNull();
  });
});
