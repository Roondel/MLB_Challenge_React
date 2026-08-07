import { describe, it, expect } from 'vitest';
import { getRouteMatrix } from '../mapsApiStub.js';

const CHASE_FIELD = { lat: 33.4455, lng: -112.0667 };     // Phoenix
const DODGER_STADIUM = { lat: 34.0739, lng: -118.24 };     // LA
const ORACLE_PARK = { lat: 37.7786, lng: -122.3893 };      // SF

describe('mapsApiStub getRouteMatrix', () => {
  it('returns one matrix entry for a single origin-destination pair', async () => {
    const result = await getRouteMatrix([CHASE_FIELD], [DODGER_STADIUM]);
    expect(result.matrix).toHaveLength(1);
    expect(result.matrix[0]).toMatchObject({ originIndex: 0, destinationIndex: 0 });
  });

  it('computes distanceMiles and durationMinutes for a known route', async () => {
    const result = await getRouteMatrix([CHASE_FIELD], [DODGER_STADIUM]);
    const { distanceMiles, durationMinutes } = result.matrix[0];
    expect(distanceMiles).toBeGreaterThan(300);
    expect(distanceMiles).toBeLessThan(550);
    expect(durationMinutes).toBeGreaterThan(250);
    expect(durationMinutes).toBeLessThan(550);
  });

  it('returns one entry per origin-destination pair with correct indices', async () => {
    const result = await getRouteMatrix(
      [CHASE_FIELD, DODGER_STADIUM],
      [DODGER_STADIUM, ORACLE_PARK]
    );
    expect(result.matrix).toHaveLength(4);
    const pairs = result.matrix.map(e => `${e.originIndex},${e.destinationIndex}`);
    expect(pairs).toEqual(expect.arrayContaining(['0,0', '0,1', '1,0', '1,1']));
  });

  it('returns near-zero distance when origin equals destination', async () => {
    const result = await getRouteMatrix([DODGER_STADIUM], [DODGER_STADIUM]);
    expect(result.matrix[0].distanceMiles).toBeLessThan(1);
  });
});
