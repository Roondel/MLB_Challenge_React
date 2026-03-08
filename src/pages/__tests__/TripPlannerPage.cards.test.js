import { describe, it, expect } from 'vitest';

function getRouteLineCities(itinerary, maxCities = 4) {
  const gameCities = itinerary.filter(s => s.game).map(s => s.city);
  const shown = gameCities.slice(0, maxCities);
  const extra = gameCities.length - shown.length;
  return { shown, extra };
}

function hasNotes(stopNotes) {
  return !!(stopNotes && Object.values(stopNotes).some(n => n?.trim().length > 0));
}

const mockItinerary = [
  { city: 'Boston',       game: { gamePk: 1 } },
  { city: 'New York',     game: { gamePk: 2 } },
  { city: 'Philadelphia', game: { gamePk: 3 } },
  { city: 'Washington',   game: { gamePk: 4 } },
  { city: 'Baltimore',    game: { gamePk: 5 } },
  { city: 'Tampa',        game: null },  // drive home — no game
];

describe('saved trip card helpers', () => {
  it('shows first 4 cities for a long route', () => {
    const { shown, extra } = getRouteLineCities(mockItinerary);
    expect(shown).toEqual(['Boston', 'New York', 'Philadelphia', 'Washington']);
    expect(extra).toBe(1);
  });

  it('shows all cities when 4 or fewer game stops', () => {
    const { shown, extra } = getRouteLineCities(mockItinerary.slice(0, 3));
    expect(shown).toHaveLength(3);
    expect(extra).toBe(0);
  });

  it('excludes drive-home stops (game: null) from route line', () => {
    const { shown } = getRouteLineCities(mockItinerary);
    expect(shown).not.toContain('Tampa');
  });

  it('hasNotes returns true when at least one stop has non-empty text', () => {
    expect(hasNotes({ 1: '', 2: 'Train at 8am', 3: '' })).toBe(true);
  });

  it('hasNotes returns false when all stops are empty or whitespace', () => {
    expect(hasNotes({ 1: '', 2: '   ' })).toBe(false);
  });

  it('hasNotes returns false when stopNotes is undefined or empty', () => {
    expect(hasNotes(undefined)).toBe(false);
    expect(hasNotes({})).toBe(false);
  });
});
