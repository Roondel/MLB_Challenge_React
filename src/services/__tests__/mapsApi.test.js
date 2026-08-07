import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Mock the auth service so api.js/mapsApi.js can import it without Amplify configuration
vi.mock('../auth.js', () => ({
  COGNITO_CONFIGURED: true,
  getIdToken: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

const ROUTE_URL = '/api/route';

function mockFetch(body, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

describe('mapsApi (real Routes API client)', () => {
  let mapsApi;

  beforeEach(async () => {
    vi.resetModules();
    mapsApi = await import('../mapsApi.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs origins/destinations to /api/route and returns the matrix', async () => {
    const matrix = [{ originIndex: 0, destinationIndex: 0, distanceMiles: 377, durationMinutes: 347 }];
    mockFetch({ matrix });

    const origins = [{ lat: 33.4455, lng: -112.0667 }];
    const destinations = [{ lat: 34.0739, lng: -118.24 }];
    const result = await mapsApi.getRouteMatrix(origins, destinations);

    expect(global.fetch).toHaveBeenCalledWith(ROUTE_URL, expect.anything());
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ origins, destinations });
    expect(result).toEqual({ matrix });
  });

  it('attaches the Cognito auth header', async () => {
    mockFetch({ matrix: [] });
    await mapsApi.getRouteMatrix([{ lat: 0, lng: 0 }], [{ lat: 1, lng: 1 }]);

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer mock-jwt-token');
  });

  it('throws with the quota-exceeded message on a 429 response', async () => {
    mockFetch({ error: 'Daily route-matrix quota exceeded (1000 elements/day)' }, false, 429);
    await expect(
      mapsApi.getRouteMatrix([{ lat: 0, lng: 0 }], [{ lat: 1, lng: 1 }])
    ).rejects.toThrow(/quota exceeded/);
  });
});
