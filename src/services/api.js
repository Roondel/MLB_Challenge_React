const VISITS_API = import.meta.env.VITE_VISITS_API;
const TRIPS_API  = import.meta.env.VITE_TRIPS_API;
const PHOTOS_API = import.meta.env.VITE_PHOTOS_API;

// True only when all three Lambda URLs are configured.
// When false the app runs in localStorage-only mode — no API calls are made.
export const API_AVAILABLE = !!(VISITS_API && TRIPS_API && PHOTOS_API);

// ── Shared fetch helper ──────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
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
    // Pass-through fields — DynamoDB stores any attribute, these round-trip cleanly
    gameAttended: visit.gameAttended,
    weather:      visit.weather,
    visitId:      visit.visitId,
    createdAt:    visit.createdAt,
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

export async function fetchAllTrips() {
  return apiFetch(TRIPS_API);
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
      createdAt: trip.savedAt,
    }),
  });
}

export async function deleteTrip(tripId) {
  return apiFetch(`${TRIPS_API}?tripId=${tripId}`, { method: 'DELETE' });
}

// ── Photos API ───────────────────────────────────────────────────────────────

// Step 1: Request a pre-signed PUT URL from the Lambda.
// Returns { uploadUrl, key } where key is always photos/{parkId}/photo.jpg
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
