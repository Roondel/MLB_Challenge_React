import { test, expect } from '@playwright/test';
import { createVisit, deleteVisit } from '../helpers/api-client.js';
import { getVisitFromDynamo, waitForVisitCreation, waitForVisitDeletion, waitForNotesUpdate  } from '../helpers/aws-client.js';
import { TEST_PARK_ID, TEST_PARK_PATH, SEED_VISIT } from '../helpers/test-data.js';

test.describe.serial('Visits — CRUD + persistence', () => {
  // Clean up before each test to ensure a known state
  test.beforeEach(async () => {
    await deleteVisit(TEST_PARK_ID).catch(() => {});
  });

  test.afterAll(async () => {
    await deleteVisit(TEST_PARK_ID).catch(() => {});
  });

  test('1. Check in to a park creates a visit record in DynamoDB', async ({ page }) => {
    await page.goto(TEST_PARK_PATH);

    // Should show "Not Yet Visited"
    await expect(page.getByText('Not Yet Visited')).toBeVisible();

    // Click Check In
    await page.getByTestId('checkin-button').click();

    // Fill the form
    await page.locator('input[type="date"]').fill('2025-07-04');
    await page.locator('textarea').fill('E2E check-in test');

    // Submit
    await page.getByTestId('checkin-submit').click();

    // Wait for modal to close — "Visited" badge should appear
    await expect(page.getByText('Visited', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Verify backend — poll DynamoDB until the async API call completes
    const item = await waitForVisitCreation(TEST_PARK_ID);
    expect(Number(item.parkId)).toBe(TEST_PARK_ID); // DynamoDB stores as number
    expect(item.notes).toBe('E2E check-in test');
    expect(item.date).toBe('2025-07-04');
    expect(item.updatedAt).toBeDefined();
  });

  test('2. Editing a visit updates the DynamoDB record', async ({ page }) => {
    // Seed a visit via API
    await createVisit(SEED_VISIT);

    await page.goto(TEST_PARK_PATH);

    // Wait for visit data to load
    await expect(page.getByText('Your Visit')).toBeVisible({ timeout: 10_000 });

    // Click edit (pencil icon)
    await page.getByTestId('edit-visit').click();

    // Update notes and rating
    await page.locator('textarea').fill('Updated notes via E2E');

    // Click 5th star for rating 5
    const stars = page.locator('[data-testid="checkin-submit"]').locator('..').locator('button svg');
    const starButtons = page.locator('form button').filter({ has: page.locator('svg') });

    // Submit the form
    await page.getByTestId('checkin-submit').click();

    // Wait for modal to close
    await expect(page.getByText('Your Visit')).toBeVisible({ timeout: 10_000 });

    // Verify backend
    const item = await waitForNotesUpdate(TEST_PARK_ID, 'Updated notes via E2E');
    expect(item.notes).toBe('Updated notes via E2E');
  });

  test('3. Deleting a visit removes it from DynamoDB', async ({ page }) => {
    // Seed a visit
    await createVisit(SEED_VISIT);

    await page.goto(TEST_PARK_PATH);
    await expect(page.getByText('Your Visit')).toBeVisible({ timeout: 10_000 });

    // Click delete (trash icon)
    await page.getByTestId('delete-visit').click();

    // Confirm dialog appears
    await expect(page.getByText('Remove Visit?')).toBeVisible();

    // Click confirm delete
    await page.getByTestId('confirm-delete').click();

    // Should show "Not Yet Visited" again
    await expect(page.getByText('Not Yet Visited')).toBeVisible({ timeout: 10_000 });

    await waitForVisitDeletion(TEST_PARK_ID);

    // Verify backend — record should be gone
    const item = await getVisitFromDynamo(TEST_PARK_ID);
    expect(item).toBeNull();
  });

  test('4. Data persists across page reload via API (not just localStorage)', async ({ page }) => {
    // Seed a visit via API
    await createVisit({ ...SEED_VISIT, notes: 'Persistence test' });

    await page.goto(TEST_PARK_PATH);
    await expect(page.getByText('Persistence test')).toBeVisible({ timeout: 10_000 });

    // Nuke localStorage
    await page.evaluate(() => localStorage.clear());

    // Reload the page
    await page.reload();

    // Data should still appear — it must have loaded from the API
    await expect(page.getByText('Persistence test')).toBeVisible({ timeout: 10_000 });
  });
});
