/**
 * Frontend auth service — wraps aws-amplify for Cognito authentication.
 *
 * Configures Amplify once at module load time using VITE_ env vars.
 * Re-exports the auth operations used throughout the app.
 *
 * VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID must be set in
 * the environment file (.env.dev / .env.production) after deploying
 * the Cognito resources via deploy.sh.
 */

import { Amplify } from 'aws-amplify';
import {
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signUp,
  confirmSignUp,
  signOut,
} from 'aws-amplify/auth';

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const CLIENT_ID    = import.meta.env.VITE_COGNITO_CLIENT_ID;

// Only configure when both vars are present (avoids errors in pure localStorage mode)
if (USER_POOL_ID && CLIENT_ID) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId:       USER_POOL_ID,
        userPoolClientId: CLIENT_ID,
      },
    },
  });
}

export const COGNITO_CONFIGURED = !!(USER_POOL_ID && CLIENT_ID);

/**
 * Returns the raw ID token string for the current Cognito session.
 * Amplify refreshes the token automatically when it nears expiry.
 * Throws if no session is active.
 */
export async function getIdToken() {
  const session = await fetchAuthSession();
  const token   = session.tokens?.idToken?.toString();
  if (!token) throw new Error('No active session');
  return token;
}

/**
 * Returns the Cognito `sub` (UUID) for the signed-in user.
 */
export async function getUserSub() {
  const user = await getCurrentUser();
  return user.userId;
}

/**
 * Returns true when a Cognito session is active.
 */
export async function isAuthenticated() {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

export { signIn, signUp, confirmSignUp, signOut };
