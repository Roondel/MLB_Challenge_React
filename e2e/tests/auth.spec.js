import { test, expect } from '@playwright/test';

const TEST_EMAIL    = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const VISITS_API    = process.env.VITE_VISITS_API;

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // Clear Amplify session keys
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k =>
        k.startsWith('CognitoIdentityServiceProvider') ||
        k.startsWith('amplify')
      )
      .forEach(k => localStorage.removeItem(k));
  });

  await page.reload({ waitUntil: 'networkidle' });

  // Wait for auth form to be fully stable
  await page.waitForSelector('[data-testid="auth-submit"]', {
    state: 'visible'
  });
});

  test('1. Valid credentials sign in and land on the dashboard', async ({ page }) => {
    // AuthPage should be visible after clearing session
    await page.getByTestId('auth-submit').click();
    await page.fill('input[type="email"]',    TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('[data-testid="auth-submit"]');

    // After successful sign-in the main app shell should render
    await expect(page.getByText('30 Ballpark Challenge')).toBeVisible({ timeout: 15_000 });
    // Dashboard content is visible
    await expect(page.getByText(/visited/i)).toBeVisible({ timeout: 5_000 });
  });

  test('2. Wrong password shows an error message', async ({ page }) => {
    await page.getByTestId('auth-submit').click();

    await page.fill('input[type="email"]',    TEST_EMAIL);
    await page.fill('input[type="password"]', 'WrongPassword999!');
    await page.click('[data-testid="auth-submit"]');

    // An error message should appear — Cognito returns NotAuthorizedException
    await expect(
      page.locator('div').filter({ hasText: /incorrect|invalid|failed/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Should still be on auth page
    await expect(page.locator('[data-testid="auth-submit"]')).toBeVisible();
  });

  test('3. Unauthenticated API request returns 401', async () => {
    if (!VISITS_API) {
      test.skip(true, 'VITE_VISITS_API not set');
      return;
    }
    const res = await fetch(VISITS_API);
    expect(res.status).toBe(401);
  });

  test('4. Sign-out clears user data and shows AuthPage', async ({ page }) => {
    // First sign in
    await page.fill('input[type="email"]',    TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('[data-testid="auth-submit"]');
    await expect(page.getByText('30 Ballpark Challenge')).toBeVisible({ timeout: 15_000 });

    // Seed some app data so we can verify it gets cleared
    await page.evaluate(() => {
      localStorage.setItem('ballpark_visits', JSON.stringify([{ visitId: '1', parkId: 109 }]));
    });

    // Click sign-out in the sidebar (desktop layout)
    await page.locator('button').filter({ hasText: /sign out/i }).click();

    // Should return to AuthPage
    await expect(page.locator('[data-testid="auth-submit"]')).toBeVisible({ timeout: 10_000 });

    // App data should be gone from localStorage
    const visits = await page.evaluate(() => localStorage.getItem('ballpark_visits'));
    expect(visits).toBeNull();
  });

  test('5. Sign-up flow behaves correctly for this environment', async ({ page }) => {
    const signupEnabled = process.env.E2E_SIGNUP_ENABLED === 'true';

    // Switch to Sign Up tab
    await page.click('button:has-text("Sign Up")');

    // Sign-up form should always be visible regardless of pool config
    await expect(page.locator('[data-testid="auth-submit"]')).toBeVisible();

    await page.fill('input[type="email"]',    `e2e-nouser-${Date.now()}@test.invalid`);
    await page.fill('input[type="password"]', 'ValidPass123!');
    await page.click('[data-testid="auth-submit"]');

    if (signupEnabled) {
      // Pool allows self-signup: expect the email verification step
      await expect(
        page.getByText(/Check your email/i)
      ).toBeVisible({ timeout: 15_000 });
    } else {
      // Pool is admin-only (AllowAdminCreateUserOnly: true): expect an error
      await expect(
        page.locator('div, p').filter({ hasText: /not allowed|not permitted|error|failed|unauthorized/i }).first()
      ).toBeVisible({ timeout: 15_000 });

      // Must still be on the auth page (no redirect to app)
      await expect(page.locator('[data-testid="auth-submit"]')).toBeVisible();
    }
  });
