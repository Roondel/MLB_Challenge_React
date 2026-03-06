import { describe, it, expect } from 'vitest';
import { getDrivingRoute } from '../mapsApiStub.js';

describe('mapsApiStub', () => {
  it('returns distanceMiles, durationMinutes, summary', async () => {
    const result = await getDrivingRoute(
      { lat: 33.4455, lng: -112.0667 }, // Chase Field (Phoenix)
      { lat: 34.0739, lng: -118.24 }    // Dodger Stadium (LA)
    );
    expect(result).toHaveProperty('distanceMiles');
    expect(result).toHaveProperty('durationMinutes');
    expect(result).toHaveProperty('summary');
    expect(result.distanceMiles).toBeGreaterThan(300);
    expect(result.distanceMiles).toBeLessThan(500);
  });

  it('durationMinutes is proportional to distanceMiles', async () => {
    const result = await getDrivingRoute(
      { lat: 33.4455, lng: -112.0667 },
      { lat: 34.0739, lng: -118.24 }
    );
    // At 60mph, ~370 miles ≈ 370 minutes
    expect(result.durationMinutes).toBeGreaterThan(250);
    expect(result.durationMinutes).toBeLessThan(500);
  });

  it('summary string contains distance and duration', async () => {
    const result = await getDrivingRoute(
      { lat: 33.4455, lng: -112.0667 },
      { lat: 34.0739, lng: -118.24 }
    );
    expect(result.summary).toContain('mi');
    expect(result.summary).toContain('min');
  });
});
