// Thin wrapper around CloudFront API paths for test data seeding and cleanup.
// These call the same endpoints the frontend uses — all requests are authenticated.

import { getTestAuthToken } from './auth-helper.js';

const BASE_URL   = (process.env.E2E_BASE_URL || '').replace(/\/$/, '');
const VISITS_API = `${BASE_URL}/api/visits`;
const TRIPS_API  = `${BASE_URL}/api/trips`;
const PHOTOS_API = `${BASE_URL}/api/photos`;

function ensureEnv() {
  if (!BASE_URL) {
    throw new Error('Missing E2E_BASE_URL env var.');
  }
}

async function authHeaders() {
  const token = await getTestAuthToken();
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ── Visits ──────────────────────────────────────────────────────────────

export async function createVisit(payload) {
  ensureEnv();
  const res = await fetch(VISITS_API, {
    method:  'POST',
    headers: await authHeaders(),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createVisit failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteVisit(parkId) {
  ensureEnv();
  const res = await fetch(`${VISITS_API}?parkId=${parkId}`, {
    method:  'DELETE',
    headers: await authHeaders(),
  });
  // 404 is fine — record might not exist
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteVisit failed: ${res.status}`);
  }
}

// ── Trips ───────────────────────────────────────────────────────────────

export async function createTrip(payload) {
  ensureEnv();
  const res = await fetch(TRIPS_API, {
    method:  'POST',
    headers: await authHeaders(),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createTrip failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteTrip(tripId) {
  ensureEnv();
  const res = await fetch(`${TRIPS_API}?tripId=${tripId}`, {
    method:  'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteTrip failed: ${res.status}`);
  }
}

// ── Photos ──────────────────────────────────────────────────────────────

export async function deletePhoto(key) {
  ensureEnv();
  const res = await fetch(`${PHOTOS_API}?key=${encodeURIComponent(key)}`, {
    method:  'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deletePhoto failed: ${res.status}`);
  }
}
