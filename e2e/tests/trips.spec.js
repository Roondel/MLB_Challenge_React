import { test, expect } from '@playwright/test';
import { createTrip, deleteTrip } from '../helpers/api-client.js';
import { getTripFromDynamo, waitForTripDeletion, waitForTripStopNote } from '../helpers/aws-client.js';
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

  test('13. Typing a stop note autosaves it to DynamoDB', async ({ page }) => {
    // Seed a trip with a routeResult so RoutePreview renders textareas when loaded
    await createTrip({
      ...SEED_TRIP,
      tripId: TRIP_ID,
      selectedParks: [109],
      stopNotes: {},
      routeResult: {
        totalMiles: 100,
        warnings: [],
        unreachableParks: [],
        itinerary: [{
          parkId: 109,
          parkName: 'Chase Field',
          teamName: 'Arizona Diamondbacks',
          city: 'Phoenix',
          driveFromPrev: null,
          game: {
            gamePk: 1001,
            date: '2025-07-04',
            gameTime: '2025-07-04T20:00:00Z',
            dayNight: 'N',
            awayTeamName: 'Los Angeles Dodgers',
          },
        }],
      },
    });

    await page.goto('/trip');
    await expect(page.getByText('E2E Test Trip')).toBeVisible({ timeout: 10_000 });

    // Load the trip — RoutePreview should render with a textarea for each stop
    await page.getByRole('button', { name: /load/i }).click();
    const textarea = page.getByRole('textbox').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    // Type a note — debounce fires after 800ms
    await textarea.fill('Take the light rail');

    // Poll DynamoDB until the note arrives (debounce 800ms + Lambda latency)
    await waitForTripStopNote(TRIP_ID, 109, 'Take the light rail', 8_000);

    const item = await getTripFromDynamo(TRIP_ID);
    expect(item.stopNotes?.[109]).toBe('Take the light rail');
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
