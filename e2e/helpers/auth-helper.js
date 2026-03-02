/**
 * Auth helpers for E2E tests.
 *
 * signInViaUI(page)   — signs in through the custom AuthPage UI
 * getTestAuthToken()  — programmatic sign-in via USER_PASSWORD_AUTH flow
 *                       (faster than UI; used for seeding API calls)
 *
 * Requires env vars in .env.dev:
 *   VITE_COGNITO_USER_POOL_ID
 *   VITE_COGNITO_CLIENT_ID
 *   E2E_TEST_EMAIL
 *   E2E_TEST_PASSWORD
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const CLIENT_ID    = process.env.VITE_COGNITO_CLIENT_ID;
const TEST_EMAIL   = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

// Module-level cache — reuse token for entire test run (1 hour TTL matches Cognito default)
let cachedToken = null;

/**
 * Gets a Cognito ID token programmatically using USER_PASSWORD_AUTH.
 * Token is cached for the test run to avoid repeated round-trips.
 */
export async function getTestAuthToken() {
  if (cachedToken) return cachedToken;

  if (!CLIENT_ID || !TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'Missing Cognito env vars for E2E auth.\n' +
      'Ensure .env.dev contains: VITE_COGNITO_CLIENT_ID, E2E_TEST_EMAIL, E2E_TEST_PASSWORD'
    );
  }

  const client = new CognitoIdentityProviderClient({ region: 'eu-west-1' });
  const command = new InitiateAuthCommand({
    AuthFlow:        'USER_PASSWORD_AUTH',
    ClientId:        CLIENT_ID,
    AuthParameters: {
      USERNAME: TEST_EMAIL,
      PASSWORD: TEST_PASSWORD,
    },
  });

  const response = await client.send(command);
  cachedToken = response.AuthenticationResult?.IdToken;
  if (!cachedToken) throw new Error('Cognito auth did not return an IdToken');
  return cachedToken;
}

/**
 * Signs in via the app's custom AuthPage UI.
 * Skips sign-in if Amplify auth keys are already in localStorage (session still valid).
 */
export async function signInViaUI(page) {
  // Navigate first — localStorage is not accessible on about:blank
  await page.goto('/');

  // Check if already authenticated (Amplify persists session keys in localStorage)
  const isAlreadyAuth = await page.evaluate(() =>
    Object.keys(localStorage).some(k => k.startsWith('CognitoIdentityServiceProvider'))
  );
  if (isAlreadyAuth) return;

  // AuthPage renders when not authenticated
  await page.waitForSelector('[data-testid="auth-submit"]', { timeout: 15_000 });

  await page.fill('input[type="email"]',    TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('[data-testid="auth-submit"]');

  // Wait until auth completes and the main app shell is visible
  await page.waitForSelector('nav, aside', { timeout: 20_000 });
}

/** Clears cached token — call between test runs if needed. */
export function clearTokenCache() {
  cachedToken = null;
}
