import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const VISITS_URL = 'https://visits.test.com/';
const TRIPS_URL  = 'https://trips.test.com/';
const PHOTOS_URL = 'https://photos.test.com/';

// Helper: stub global fetch with a resolved JSON response
function mockFetch(body, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

// Each test gets a fresh module with env vars set so module-level constants are correct
describe('api module', () => {
  let api;

  beforeEach(async () => {
    vi.stubEnv('VITE_VISITS_API', VISITS_URL);
    vi.stubEnv('VITE_TRIPS_API',  TRIPS_URL);
    vi.stubEnv('VITE_PHOTOS_API', PHOTOS_URL);
    vi.resetModules();
    api = await import('../api.js');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── API_AVAILABLE ────────────────────────────────────────────────────────────

  describe('API_AVAILABLE', () => {
    it('is true when all three env vars are set', () => {
      expect(api.API_AVAILABLE).toBe(true);
    });

    it('is false when VITE_VISITS_API is missing', async () => {
      vi.stubEnv('VITE_VISITS_API', '');
      vi.resetModules();
      const mod = await import('../api.js');
      expect(mod.API_AVAILABLE).toBe(false);
    });

    it('is false when all vars are missing', async () => {
      vi.unstubAllEnvs();
      vi.resetModules();
      const mod = await import('../api.js');
      expect(mod.API_AVAILABLE).toBe(false);
    });
  });

  // ── fetchAllVisits ───────────────────────────────────────────────────────────

  describe('fetchAllVisits', () => {
    it('calls the visits URL and normalises backend field names', async () => {
      const backendRecord = {
        parkId:      109,
        visitId:     'abc',
        date:        '2025-07-04',
        notes:       'Great game',
        rating:      4,
        score:       'ARI 5 - LAD 3',
        opponent:    'Dodgers',
        gameAttended: true,
        weather:     '72°F, Sunny',
        photoKeys:   ['photos/109/photo.jpg'],
        createdAt:   '2025-07-04T20:00:00Z',
      };
      mockFetch([backendRecord]);

      const visits = await api.fetchAllVisits();

      expect(global.fetch).toHaveBeenCalledWith(VISITS_URL, expect.anything());
      expect(visits).toHaveLength(1);
      const v = visits[0];
      expect(v.visitDate).toBe('2025-07-04');
      expect(v.personalNote).toBe('Great game');
      expect(v.gameScore).toBe('ARI 5 - LAD 3');
      expect(v.visitId).toBe('abc');
      expect(v.parkId).toBe(109);
      expect(v.photoKeys).toEqual(['photos/109/photo.jpg']);
    });

    it('falls back visitId to String(parkId) when not present in backend record', async () => {
      mockFetch([{ parkId: 110, date: '2025-01-01' }]);
      const visits = await api.fetchAllVisits();
      expect(visits[0].visitId).toBe('110');
    });

    it('supplies safe defaults for all missing fields', async () => {
      mockFetch([{ parkId: 111 }]);
      const [v] = await api.fetchAllVisits();
      expect(v.visitDate).toBe('');
      expect(v.personalNote).toBe('');
      expect(v.gameScore).toBe('');
      expect(v.opponent).toBe('');
      expect(v.weather).toBe('');
      expect(v.rating).toBe(0);
      expect(v.gameAttended).toBe(false);
      expect(v.photoKeys).toEqual([]);
    });
  });

  // ── saveVisit ────────────────────────────────────────────────────────────────

  describe('saveVisit', () => {
    it('sends frontend fields mapped to backend names', async () => {
      const frontendVisit = {
        parkId:       109,
        visitId:      'abc',
        visitDate:    '2025-07-04',
        personalNote: 'Great',
        rating:       5,
        gameScore:    'ARI 4 - LAD 2',
        opponent:     'Dodgers',
        gameAttended: true,
        weather:      '75°F',
        photoKeys:    ['photos/109/photo.jpg'],
        createdAt:    '2025-07-04T12:00:00Z',
      };
      // Backend echoes the record back (simplified)
      mockFetch({ parkId: 109, date: '2025-07-04', visitId: 'abc' });

      await api.saveVisit(frontendVisit);

      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(VISITS_URL);
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body);
      // Mapped fields
      expect(body.date).toBe('2025-07-04');
      expect(body.notes).toBe('Great');
      expect(body.score).toBe('ARI 4 - LAD 2');
      // Original frontend names must NOT appear in the body
      expect(body.visitDate).toBeUndefined();
      expect(body.personalNote).toBeUndefined();
      expect(body.gameScore).toBeUndefined();
    });

    it('normalises the returned record back to frontend shape', async () => {
      mockFetch({ parkId: 109, date: '2025-07-04', notes: 'Great', score: 'ARI 4 - LAD 2', visitId: 'abc' });
      const result = await api.saveVisit({ parkId: 109, visitId: 'abc', visitDate: '2025-07-04', personalNote: 'Great', gameScore: 'ARI 4 - LAD 2', photoKeys: [] });
      expect(result.visitDate).toBe('2025-07-04');
      expect(result.personalNote).toBe('Great');
      expect(result.gameScore).toBe('ARI 4 - LAD 2');
    });
  });

  // ── deleteVisit ──────────────────────────────────────────────────────────────

  describe('deleteVisit', () => {
    it('sends DELETE to the visits URL with ?parkId param', async () => {
      mockFetch({});
      await api.deleteVisit(109);
      expect(global.fetch).toHaveBeenCalledWith(
        `${VISITS_URL}?parkId=109`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ── fetchAllTrips / saveTrip / deleteTrip ────────────────────────────────────

  describe('fetchAllTrips', () => {
    it('calls the trips URL and returns the raw array', async () => {
      const trips = [{ tripId: 'xyz', name: 'West Coast' }];
      mockFetch(trips);
      const result = await api.fetchAllTrips();
      expect(global.fetch).toHaveBeenCalledWith(TRIPS_URL, expect.anything());
      expect(result).toEqual(trips);
    });
  });

  describe('saveTrip', () => {
    it('sends the correct body shape', async () => {
      mockFetch({ tripId: 'xyz' });
      const trip = {
        tripId:        'xyz',
        name:          'West Coast',
        selectedParks: [109, 119],
        routeResult:   [],
        startDate:     '2025-07-01',
        endDate:       '2025-07-10',
        startCity:     'Phoenix',
        savedAt:       '2025-01-01T00:00:00Z',
      };
      await api.saveTrip(trip);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.parks).toEqual([109, 119]);
      expect(body.itinerary).toEqual([]);
      expect(body.createdAt).toBe('2025-01-01T00:00:00Z');
    });
  });

  describe('deleteTrip', () => {
    it('sends DELETE with ?tripId param', async () => {
      mockFetch({});
      await api.deleteTrip('xyz');
      expect(global.fetch).toHaveBeenCalledWith(
        `${TRIPS_URL}?tripId=xyz`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ── Photos API ───────────────────────────────────────────────────────────────

  describe('requestUploadUrl', () => {
    it('sends POST with parkId, filename, contentType', async () => {
      mockFetch({ uploadUrl: 'https://s3.example.com/upload', key: 'photos/109/photo.jpg' });
      const result = await api.requestUploadUrl(109, 'photo.jpg', 'image/jpeg');
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({ parkId: 109, filename: 'photo.jpg', contentType: 'image/jpeg' });
      expect(result.key).toBe('photos/109/photo.jpg');
    });
  });

  describe('putToS3', () => {
    it('sends PUT with raw blob body (not JSON-wrapped)', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      const blob = new Blob(['img-data'], { type: 'image/jpeg' });
      await api.putToS3('https://s3-signed.example.com/upload', blob, 'image/jpeg');

      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe('https://s3-signed.example.com/upload');
      expect(opts.method).toBe('PUT');
      expect(opts.headers['Content-Type']).toBe('image/jpeg');
      expect(opts.body).toBe(blob);
      // S3 pre-signed PUT must NOT have Content-Type: application/json header
      expect(opts.headers['content-type']).toBeUndefined();
    });

    it('throws on a non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
      await expect(
        api.putToS3('https://s3.example.com', new Blob(), 'image/jpeg'),
      ).rejects.toThrow('S3 upload failed: 403');
    });
  });

  describe('fetchDownloadUrl', () => {
    it('returns the downloadUrl from the Lambda response', async () => {
      mockFetch({ downloadUrl: 'https://cdn.example.com/photo.jpg' });
      const url = await api.fetchDownloadUrl('photos/109/photo.jpg');
      expect(url).toBe('https://cdn.example.com/photo.jpg');
    });

    it('URL-encodes the key in the query string', async () => {
      mockFetch({ downloadUrl: 'https://cdn.example.com/photo.jpg' });
      await api.fetchDownloadUrl('photos/109/photo.jpg');
      expect(global.fetch).toHaveBeenCalledWith(
        `${PHOTOS_URL}?key=photos%2F109%2Fphoto.jpg`,
        expect.anything(),
      );
    });
  });

  describe('deletePhoto', () => {
    it('sends DELETE with URL-encoded key', async () => {
      mockFetch({});
      await api.deletePhoto('photos/109/photo.jpg');
      expect(global.fetch).toHaveBeenCalledWith(
        `${PHOTOS_URL}?key=photos%2F109%2Fphoto.jpg`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws with status code when API returns non-ok response', async () => {
      mockFetch('Not Found', false, 404);
      await expect(api.fetchAllVisits()).rejects.toThrow('API 404');
    });
  });
});
