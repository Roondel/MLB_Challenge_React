import { test, expect } from '@playwright/test';

const TEST_EMAIL    = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const VISITS_API    = process.env.VITE_VISITS_API;

test.describe.serial('Authentication', () => {
  // Sign out before each test to start from an unauthenticated state
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear Amplify session storage so each test starts unauthenticated
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(k => k.startsWith('CognitoIdentityServiceProvider') || k.startsWith('amplify'))
        .forEach(k => localStorage.removeItem(k));
    });
    await page.reload();
  });

  test('1. Valid credentials sign in and land on the dashboard', async ({ page }) => {
    // AuthPage should be visible after clearing session
    await expect(page.getByText('Sign In')).toBeVisible({ timeout: 10_000 });

    await page.fill('input[type="email"]',    TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('[data-testid="auth-submit"]');

    // After successful sign-in the main app shell should render
    await expect(page.getByText('30 Ballpark Challenge')).toBeVisible({ timeout: 15_000 });
    // Dashboard content is visible
    await expect(page.getByText(/visited/i)).toBeVisible({ timeout: 5_000 });
  });

  test('2. Wrong password shows an error message', async ({ page }) => {
    await expect(page.getByText('Sign In')).toBeVisible({ timeout: 10_000 });

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

  test('5. Sign-up flow shows verification code input', async ({ page }) => {
    await expect(page.getByText('Sign In')).toBeVisible({ timeout: 10_000 });

    // Switch to Sign Up tab
    await page.click('button:has-text("Sign Up")');

    // Fill sign-up form with a non-existent email (we won't complete it)
    await page.fill('input[type="email"]',    `e2e-nouser-${Date.now()}@test.invalid`);
    await page.fill('input[type="password"]', 'ValidPass123!');
    await page.click('[data-testid="auth-submit"]');

    // After submitting, the verification code input should appear
    // (Cognito sends a code; we just verify the UI transitions correctly)
    await expect(
      page.getByText(/verification code|check your email/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
