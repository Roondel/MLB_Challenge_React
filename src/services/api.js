import { COGNITO_CONFIGURED, getIdToken } from './auth.js';

const VISITS_API = '/api/visits';
const TRIPS_API  = '/api/trips';
const PHOTOS_API = '/api/photos';

// Always true — all API traffic routes through CloudFront at relative /api/* paths.
export const API_AVAILABLE = true;

// Sentinel thrown by apiFetch when the server returns 401.
// Callers can catch this to trigger a re-auth flow.
export const AUTH_EXPIRED = Symbol('AUTH_EXPIRED');

// ── Shared fetch helper ──────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  // Inject Cognito ID token when available
  let authHeader = {};
  if (COGNITO_CONFIGURED) {
    try {
      const token = await getIdToken();
      authHeader = { Authorization: `Bearer ${token}` };
    } catch {
      // No active session — let the request proceed; Lambda will return 401
    }
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw AUTH_EXPIRED;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Field mapping ────────────────────────────────────────────────────────────
// All frontend ↔ backend translation happens here, nowhere else.

function visitToBackend(visit) {
  return {
    parkId:       visit.parkId,
    date:         visit.visitDate,
    rating:       visit.rating,
    notes:        visit.personalNote,
    photoKeys:    visit.photoKeys ?? [],
    opponent:     visit.opponent,
    score:        visit.gameScore,
    visited:      true,
    // Pass-through fields — DynamoDB stores any attribute, these round-trip cleanly
    gameAttended: visit.gameAttended,
    weather:      visit.weather,
    visitId:      visit.visitId,
    // createdAt intentionally omitted — Lambda owns it via if_not_exists semantics
  };
}

function visitFromBackend(item) {
  return {
    visitId:      item.visitId   ?? String(item.parkId),
    createdAt:    item.createdAt ?? item.updatedAt ?? new Date().toISOString(),
    parkId:       item.parkId,
    visitDate:    item.date      ?? '',
    personalNote: item.notes     ?? '',
    rating:       item.rating    ?? 0,
    gameScore:    item.score     ?? '',
    opponent:     item.opponent  ?? '',
    gameAttended: item.gameAttended ?? false,
    weather:      item.weather   ?? '',
    photoKeys:    item.photoKeys ?? [],
  };
}

// ── Visits API ───────────────────────────────────────────────────────────────

export async function fetchAllVisits() {
  const items = await apiFetch(VISITS_API);
  return items.map(visitFromBackend);
}

export async function saveVisit(visit) {
  const item = await apiFetch(VISITS_API, {
    method: 'POST',
    body: JSON.stringify(visitToBackend(visit)),
  });
  return visitFromBackend(item);
}

export async function deleteVisit(parkId) {
  return apiFetch(`${VISITS_API}?parkId=${parkId}`, { method: 'DELETE' });
}

// ── Trips API ────────────────────────────────────────────────────────────────

function tripFromBackend(item) {
  return {
    ...item,
    selectedParks: item.parks     ?? [],
    routeResult:   item.itinerary ?? null,
  };
}

export async function fetchAllTrips() {
  const items = await apiFetch(TRIPS_API);
  return items.map(tripFromBackend);
}

export async function saveTrip(trip) {
  return apiFetch(TRIPS_API, {
    method: 'POST',
    body: JSON.stringify({
      tripId:    trip.tripId,
      name:      trip.name,
      parks:     trip.selectedParks,
      itinerary: trip.routeResult,
      startDate: trip.startDate,
      endDate:   trip.endDate,
      startCity: trip.startCity,
    }),
  });
}

export async function deleteTrip(tripId) {
  return apiFetch(`${TRIPS_API}?tripId=${tripId}`, { method: 'DELETE' });
}

// ── Photos API ───────────────────────────────────────────────────────────────

// Step 1: Request a pre-signed PUT URL from the Lambda.
// Returns { uploadUrl, key } where key is photos/{userId}/{parkId}/photo.jpg
export async function requestUploadUrl(parkId, filename, contentType) {
  return apiFetch(PHOTOS_API, {
    method: 'POST',
    body: JSON.stringify({ parkId, filename, contentType }),
  });
}

// Step 2: PUT the raw Blob directly to S3 using the pre-signed URL.
// Must NOT go through the API helper — S3 expects the raw binary body.
export async function putToS3(uploadUrl, blob, contentType) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
}

// Get a fresh pre-signed GET URL for a stored S3 key (expires in 5 min).
export async function fetchDownloadUrl(key) {
  const data = await apiFetch(`${PHOTOS_API}?key=${encodeURIComponent(key)}`);
  return data.downloadUrl;
}

export async function deletePhoto(key) {
  return apiFetch(`${PHOTOS_API}?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
}
