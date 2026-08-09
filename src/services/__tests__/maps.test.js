import { describe, it, expect, vi, afterEach } from 'vitest';

const mockRealGetRouteMatrix = vi.fn().mockResolvedValue({ matrix: 'real' });
vi.mock('../mapsApi.js', () => ({
  getRouteMatrix: (...args) => mockRealGetRouteMatrix(...args),
}));

const mockStubGetRouteMatrix = vi.fn().mockResolvedValue({ matrix: 'stub' });
vi.mock('../mapsApiStub.js', () => ({
  getRouteMatrix: (...args) => mockStubGetRouteMatrix(...args),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('getRouteMatrix feature-flag switch', () => {
  it('routes to the real mapsApi module when VITE_USE_REAL_MAPS is "true"', async () => {
    vi.stubEnv('VITE_USE_REAL_MAPS', 'true');
    const { getRouteMatrix } = await import('../maps.js');

    const result = await getRouteMatrix([{ lat: 1, lng: 1 }], [{ lat: 2, lng: 2 }]);

    expect(mockRealGetRouteMatrix).toHaveBeenCalled();
    expect(mockStubGetRouteMatrix).not.toHaveBeenCalled();
    expect(result).toEqual({ matrix: 'real' });
  });

  it('routes to the stub module when VITE_USE_REAL_MAPS is not "true"', async () => {
    vi.stubEnv('VITE_USE_REAL_MAPS', 'false');
    const { getRouteMatrix } = await import('../maps.js');

    await getRouteMatrix([{ lat: 1, lng: 1 }], [{ lat: 2, lng: 2 }]);

    expect(mockStubGetRouteMatrix).toHaveBeenCalled();
    expect(mockRealGetRouteMatrix).not.toHaveBeenCalled();
  });
});
