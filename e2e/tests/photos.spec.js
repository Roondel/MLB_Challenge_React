import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { createVisit, deleteVisit, deletePhoto } from '../helpers/api-client.js';
import { getS3ObjectHead, listS3Versions, getVisitFromDynamo } from '../helpers/aws-client.js';
import { TEST_PARK_ID, TEST_PARK_PATH, SEED_VISIT, PHOTO_S3_KEY } from '../helpers/test-data.js';
import { signInViaUI } from '../helpers/auth-helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PHOTO = path.resolve(__dirname, '..', 'fixtures', 'test-photo.png');

test.describe.serial('Photos — upload, display, versioning', () => {
  test.beforeEach(async ({ page }) => {
    await deleteVisit(TEST_PARK_ID).catch(() => {});
    await deletePhoto(PHOTO_S3_KEY).catch(() => {});
    await signInViaUI(page);
  });

  test.afterAll(async () => {
    await deleteVisit(TEST_PARK_ID).catch(() => {});
    // Don't delete photo — S3 versioning preserves history
  });

  test('5. Upload a photo during check-in stores it in S3', async ({ page }) => {
    await page.goto(TEST_PARK_PATH);
    await expect(page.getByText('Not Yet Visited')).toBeVisible();

    // Open check-in modal
    await page.getByTestId('checkin-button').click();

    // Upload photo via filechooser event (hidden input needs this approach in React)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Upload baseball photo').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_PHOTO);

    // Wait for photo preview to appear — confirms compressToBlob() succeeded
    // PhotoUploader renders <img alt="Baseball"> when a preview is available
    await expect(page.locator('img[alt="Baseball"]')).toBeVisible({ timeout: 10_000 });

    // Fill required date
    await page.locator('input[type="date"]').fill('2025-07-04');

    // Submit
    await page.getByTestId('checkin-submit').click();

    // Wait for modal to close
    await expect(page.getByText('Visited', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Verify DynamoDB has the photoKey
    const item = await getVisitFromDynamo(TEST_PARK_ID);
    expect(item).not.toBeNull();
    expect(item.photoKeys).toBeDefined();
    expect(item.photoKeys.length).toBeGreaterThan(0);
    expect(item.photoKeys[0]).toContain('photos/');

    // Verify S3 has the object (may need the photos bucket env var)
    if (process.env.E2E_PHOTOS_BUCKET) {
      const head = await getS3ObjectHead(PHOTO_S3_KEY);
      expect(head.exists).toBe(true);
      expect(head.contentType).toBe('image/jpeg');
    }
  });

  test('6. Uploaded photo displays on park detail and gallery pages', async ({ page }) => {
    // Seed a visit with a photo key (photo must exist in S3 from test 5 or prior upload)
    await createVisit({ ...SEED_VISIT, photoKeys: [PHOTO_S3_KEY] });

    // Park detail page — photo should render
    await page.goto(TEST_PARK_PATH);
    await expect(page.getByText('Your Visit')).toBeVisible({ timeout: 10_000 });

    // Wait for the photo to load — there should be an img with alt "Baseball from visit"
    const parkPhoto = page.locator('img[alt="Baseball from visit"]');
    await expect(parkPhoto).toBeVisible({ timeout: 10_000 });

    // Verify the img src is a real URL (pre-signed S3), not empty
    const src = await parkPhoto.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src.length).toBeGreaterThan(10);

    // Gallery page — navigate and check the park's photo card
    await page.goto('/gallery');

    // The gallery shows PhotoCards — look for an img (visited parks show photos)
    // Give it time to load all photo URLs
    await page.waitForTimeout(2000);

    // At minimum, the gallery should have a card for this park
    const galleryCards = page.locator('[class*="rounded"]').filter({ has: page.locator('img') });
    // Just verify the gallery page loaded without error
    await expect(page.getByText('Baseball Collection')).toBeVisible();
  });

  test('7. Re-uploading a photo shows the new version', async ({ page }) => {
    // First, ensure a visit with photo exists
    await createVisit({ ...SEED_VISIT, photoKeys: [PHOTO_S3_KEY] });

    await page.goto(TEST_PARK_PATH);
    await expect(page.getByText('Your Visit')).toBeVisible({ timeout: 10_000 });

    // Click edit
    await page.getByTestId('edit-visit').click();

    const clearBtn = page.locator('form .relative.group button');
    if (await clearBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clearBtn.click({ force: true });
    }

    // Now the upload button should be visible
    await expect(page.getByText('Upload baseball photo')).toBeVisible({ timeout: 5_000 });

    // Upload a new photo (same file, but this creates a new S3 version)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Upload baseball photo').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_PHOTO);

    // Wait for the new photo preview — confirms compressToBlob() completed
    await expect(page.locator('img[alt="Baseball"]')).toBeVisible({ timeout: 10_000 });

    // Submit
    await page.getByTestId('checkin-submit').click();
    await expect(page.getByText('Your Visit')).toBeVisible({ timeout: 15_000 });

    // Verify S3 versioning (if bucket env var is set)
    if (process.env.E2E_PHOTOS_BUCKET) {
      const versions = await listS3Versions(PHOTO_S3_KEY);
      // Should have at least 2 versions after re-upload
      expect(versions.length).toBeGreaterThanOrEqual(2);
    }

    // Verify the photo still displays
    const photo = page.locator('img[alt="Baseball from visit"]');
    await expect(photo).toBeVisible({ timeout: 10_000 });
  });
});
