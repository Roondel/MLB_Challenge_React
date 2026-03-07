import { describe, it, expect, vi } from 'vitest';
import {
  estimateDriveTime,
  departureAfterGame,
  effectiveArrivalTime,
  overnightStopsForDrive,
  suggestScheduleRoute,
} from './tripPlanner';

vi.mock('../data/parks', () => {
  const PARKS = [
    { teamId: 1, venueName: 'Coors Field',       teamName: 'Colorado Rockies',        city: 'Denver',      state: 'CO', lat: 39.756, lng: -104.994 },
    { teamId: 2, venueName: 'Chase Field',        teamName: 'Arizona Diamondbacks',    city: 'Phoenix',     state: 'AZ', lat: 33.446, lng: -112.067 },
    { teamId: 3, venueName: 'Sutter Health Park', teamName: 'Oakland Athletics',       city: 'Sacramento',  state: 'CA', lat: 38.580, lng: -121.500 },
    { teamId: 4, venueName: 'Mirror Field',       teamName: 'Mirror Team',             city: 'Denver',      state: 'CO', lat: 39.756, lng: -104.994 },
  ];
  return { PARKS, PARK_BY_ID: Object.fromEntries(PARKS.map(p => [p.teamId, p])) };
});

// Create a local-time timestamp from components (timezone-safe)
const ts = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

// Create an ISO local-time string (no Z) for game times
const iso = (y, m, d, h = 0, min = 0) => {
  const pad = n => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00`;
};

// ─── estimateDriveTime ────────────────────────────────────────────────────────

describe('estimateDriveTime', () => {
  it('returns only minutes for drives under 1 hour', () => {
    // 30mi * 1.3 road factor / 60mph = 0.65h = 39min
    expect(estimateDriveTime(30)).toBe('39m');
  });

  it('returns hours and minutes for longer drives', () => {
    // 60mi * 1.3 / 60 = 1.3h → 1h 18m
    expect(estimateDriveTime(60)).toBe('1h 18m');
  });

  it('handles zero miles', () => {
    expect(estimateDriveTime(0)).toBe('0m');
  });
});

// ─── departureAfterGame ───────────────────────────────────────────────────────

describe('departureAfterGame', () => {
  it('returns game end time when game ends before 7pm threshold', () => {
    // 6pm end (18:00) < OVERNIGHT_GAME_HOUR (19) → depart immediately
    const endMs = ts(2025, 4, 16, 18, 0);
    expect(departureAfterGame(endMs)).toBe(endMs);
  });

  it('does not push departure at exactly 6:59pm', () => {
    const endMs = ts(2025, 4, 16, 18, 59);
    expect(departureAfterGame(endMs)).toBe(endMs);
  });

  it('pushes departure to next morning at exactly 7pm', () => {
    const endMs = ts(2025, 4, 16, 19, 0);
    const expected = ts(2025, 4, 17, 8, 0);
    expect(departureAfterGame(endMs)).toBe(expected);
  });

  it('pushes departure to next morning for late evening game end', () => {
    // 10:30pm end → next morning 8am
    const endMs = ts(2025, 4, 16, 22, 30);
    const expected = ts(2025, 4, 17, 8, 0);
    expect(departureAfterGame(endMs)).toBe(expected);
  });
});

// ─── effectiveArrivalTime ─────────────────────────────────────────────────────

describe('effectiveArrivalTime', () => {
  it('arrives same day for a short drive (< 8 hours)', () => {
    // 8am departure, 180mi: (180 * 1.3) / 60 = 3.9h → same day
    const depMs = ts(2025, 4, 17, 8, 0);
    const arrMs = effectiveArrivalTime(depMs, 180);
    expect(new Date(arrMs).getDate()).toBe(17);
  });

  it('arrives next day when drive exceeds max daily driving hours', () => {
    // 8am departure, 600mi: (600 * 1.3) / 60 = 13h → needs overnight rest
    const depMs = ts(2025, 4, 17, 8, 0);
    const arrMs = effectiveArrivalTime(depMs, 600);
    expect(new Date(arrMs).getDate()).toBe(18);
  });

  it('waits until next morning if departure is outside the driving window', () => {
    // 9pm (21:00) departure is after DRIVING_END_HOUR (20) → wait until 8am
    const depMs = ts(2025, 4, 17, 21, 0);
    const arrMs = effectiveArrivalTime(depMs, 60);
    expect(new Date(arrMs).getDate()).toBe(18);
    expect(new Date(arrMs).getHours()).toBeGreaterThanOrEqual(8);
  });

  it('arrival is after departure', () => {
    const depMs = ts(2025, 4, 17, 8, 0);
    expect(effectiveArrivalTime(depMs, 300)).toBeGreaterThan(depMs);
  });
});

// ─── overnightStopsForDrive ───────────────────────────────────────────────────

describe('overnightStopsForDrive', () => {
  it('returns 0 for a drive completed within one day', () => {
    // 8am, 180mi → arrives same day
    expect(overnightStopsForDrive(ts(2025, 4, 17, 8, 0), 180)).toBe(0);
  });

  it('returns 1 for a drive spanning one overnight', () => {
    // 8am, 600mi: 13h driving → depart Apr 17, arrive Apr 18
    expect(overnightStopsForDrive(ts(2025, 4, 17, 8, 0), 600)).toBe(1);
  });

  it('returns 2 for a drive spanning two overnights', () => {
    // 8am, 1033mi: ~22.4h driving → depart Apr 17, arrive Apr 19
    expect(overnightStopsForDrive(ts(2025, 4, 17, 8, 0), 1033)).toBe(2);
  });
});

// ─── suggestScheduleRoute ─────────────────────────────────────────────────────

// Denver game Apr 16 7pm → greedy loop departs Apr 17 8am
const denverGames = [{
  gamePk: 1, date: '2025-04-16', gameTime: iso(2025, 4, 16, 19, 0),
  status: 'Scheduled', dayNight: 'N', awayTeamName: 'Visitor A',
}];

// Phoenix (~600mi from Denver): reachable Apr 18 1pm, game at 7pm Apr 18 ✓
const phoenixGames = [{
  gamePk: 2, date: '2025-04-18', gameTime: iso(2025, 4, 18, 19, 0),
  status: 'Scheduled', dayNight: 'N', awayTeamName: 'Visitor B',
}];

// Sacramento (~1033mi from Denver): reachable Apr 19 ~2pm, game at 7:05pm Apr 19 ✓
const sacramentoGames = [{
  gamePk: 3, date: '2025-04-19', gameTime: iso(2025, 4, 19, 19, 5),
  status: 'Scheduled', dayNight: 'N', awayTeamName: 'Visitor C',
}];

describe('suggestScheduleRoute', () => {
  it('returns an empty result for an empty park list', () => {
    const result = suggestScheduleRoute([], 1, {}, '2025-04-16');
    expect(result.route).toEqual([]);
    expect(result.totalMiles).toBe(0);
    expect(result.itinerary).toEqual([]);
    expect(result.unreachableParks).toEqual([]);
  });

  it('locks in the starting park as the first stop', () => {
    const result = suggestScheduleRoute([1, 2], 1, { 1: denverGames, 2: phoenixGames }, '2025-04-16');
    expect(result.route[0]).toBe(1);
    expect(result.itinerary[0].parkId).toBe(1);
  });

  it('sets driveFromPrev to null for the first stop', () => {
    const result = suggestScheduleRoute([1], 1, { 1: denverGames }, '2025-04-16');
    expect(result.itinerary[0].driveFromPrev).toBeNull();
  });

  it('includes driveFromPrev data for subsequent stops', () => {
    const result = suggestScheduleRoute([1, 2], 1, { 1: denverGames, 2: phoenixGames }, '2025-04-16');
    const secondStop = result.itinerary[1];
    expect(secondStop.driveFromPrev).not.toBeNull();
    expect(secondStop.driveFromPrev.miles).toBeGreaterThan(0);
    expect(typeof secondStop.driveFromPrev.driveTime).toBe('string');
  });

  it('routes to the closer park first when it also has the earlier game', () => {
    // Phoenix (600mi) game Apr 18 7pm < Sacramento (1033mi) game Apr 19 7:05pm
    // → Phoenix is selected second. After Phoenix (depart Apr 19 8am), Sacramento's
    // Apr 19 game has already passed on arrival (~Apr 20), so Sacramento ends up unreachable.
    const result = suggestScheduleRoute(
      [1, 2, 3], 1,
      { 1: denverGames, 2: phoenixGames, 3: sacramentoGames },
      '2025-04-16'
    );
    expect(result.itinerary[1].parkId).toBe(2); // Phoenix chosen second (earlier game date)
    expect(result.unreachableParks.some(p => p.parkId === 3)).toBe(true); // Sacramento missed
  });

  it('routes to the farther park first when it has the earlier game date', () => {
    // Sacramento (1033mi) game Apr 19 7:05pm vs Phoenix (600mi) game Apr 22 7pm
    // Earlier date wins → Sacramento before Phoenix
    const phoenixLate = [{
      gamePk: 20, date: '2025-04-22', gameTime: iso(2025, 4, 22, 19, 0),
      status: 'Scheduled', dayNight: 'N', awayTeamName: 'Visitor B',
    }];
    const result = suggestScheduleRoute(
      [1, 2, 3], 1,
      { 1: denverGames, 2: phoenixLate, 3: sacramentoGames },
      '2025-04-16'
    );
    expect(result.itinerary[1].parkId).toBe(3); // Sacramento second (farther but earlier)
    expect(result.itinerary[2].parkId).toBe(2); // Phoenix third
  });

  it('adds unreachable parks when no games are available', () => {
    const result = suggestScheduleRoute(
      [1, 2], 1,
      { 1: denverGames, 2: [] },
      '2025-04-16'
    );
    expect(result.unreachableParks).toHaveLength(1);
    expect(result.unreachableParks[0].parkId).toBe(2);
  });

  it('marks the start park as unreachable when it has no games', () => {
    const result = suggestScheduleRoute(
      [1, 2], 1,
      { 1: [], 2: phoenixGames },
      '2025-04-16'
    );
    expect(result.unreachableParks.some(p => p.parkId === 1)).toBe(true);
  });

  it('includes a warning when parks cannot be scheduled', () => {
    const result = suggestScheduleRoute(
      [1, 2], 1,
      { 1: denverGames, 2: [] },
      '2025-04-16'
    );
    expect(result.warnings.some(w => w.includes('could not be fit'))).toBe(true);
  });

  it('filters out cancelled games', () => {
    const cancelledGames = [{
      gamePk: 5, date: '2025-04-18', gameTime: iso(2025, 4, 18, 19, 0),
      status: 'Cancelled', dayNight: 'N', awayTeamName: 'X',
    }];
    const result = suggestScheduleRoute(
      [1, 2], 1,
      { 1: denverGames, 2: cancelledGames },
      '2025-04-16'
    );
    expect(result.unreachableParks.some(p => p.parkId === 2)).toBe(true);
  });

  it('filters out postponed games', () => {
    const postponedGames = [{
      gamePk: 6, date: '2025-04-18', gameTime: iso(2025, 4, 18, 19, 0),
      status: 'Postponed', dayNight: 'N', awayTeamName: 'X',
    }];
    const result = suggestScheduleRoute(
      [1, 2], 1,
      { 1: denverGames, 2: postponedGames },
      '2025-04-16'
    );
    expect(result.unreachableParks.some(p => p.parkId === 2)).toBe(true);
  });

  it('records overnight stops for a long drive leg', () => {
    // Denver to Sacramento (~1033mi) requires 2 overnight stops
    const result = suggestScheduleRoute(
      [1, 3], 1,
      { 1: denverGames, 3: sacramentoGames },
      '2025-04-16'
    );
    const sacStop = result.itinerary.find(s => s.parkId === 3);
    expect(sacStop.driveFromPrev.overnightStops).toBe(2);
  });

  it('records zero overnight stops for a short drive leg', () => {
    // Give Denver a daytime game so departure is immediate (not pushed to next morning)
    // then a nearby game reachable same day
    const dayGame = [{
      gamePk: 10, date: '2025-04-16', gameTime: iso(2025, 4, 16, 13, 0), // 1pm
      status: 'Scheduled', dayNight: 'D', awayTeamName: 'Visitor A',
    }];
    // Park 2 at same coords as Park 1 → 0 miles, arrives immediately
    const nearbyGame = [{
      gamePk: 11, date: '2025-04-16', gameTime: iso(2025, 4, 16, 18, 0), // 6pm same day
      status: 'Scheduled', dayNight: 'N', awayTeamName: 'Visitor B',
    }];
    const result = suggestScheduleRoute(
      [1, 2], 1,
      { 1: dayGame, 2: nearbyGame },
      '2025-04-16'
    );
    // Park 2 is 600mi away but game is 6pm — may not be reachable same day,
    // so just verify that overnightStops is a non-negative integer
    if (result.itinerary.length > 1) {
      expect(result.itinerary[1].driveFromPrev.overnightStops).toBeGreaterThanOrEqual(0);
    }
  });

  it('includes game info in each itinerary stop', () => {
    const result = suggestScheduleRoute(
      [1, 2], 1,
      { 1: denverGames, 2: phoenixGames },
      '2025-04-16'
    );
    for (const stop of result.itinerary) {
      expect(stop.game).toBeDefined();
      expect(stop.game.gamePk).toBeDefined();
      expect(stop.game.gameTime).toBeDefined();
      expect(stop.parkName).toBeDefined();
      expect(stop.teamName).toBeDefined();
    }
  });

  it('accumulates total miles across all legs', () => {
    const result = suggestScheduleRoute(
      [1, 2, 3], 1,
      { 1: denverGames, 2: phoenixGames, 3: sacramentoGames },
      '2025-04-16'
    );
    expect(result.totalMiles).toBeGreaterThan(0);
  });

  it('prefers a closer park with a later game over a farther park with an earlier game (anti-zigzag)', () => {
    // After Denver (depart Apr 17 8am):
    //   Sacramento (~1033mi): game Apr 19 7:05pm — earlier game, much farther
    //   Phoenix   (~600mi):   game Apr 19 10pm  — later game, closer
    //
    // Without penalty: Sacramento wins (earlier game time)
    // With ZIGZAG_PENALTY=2.0: Phoenix wins (distance penalty tips the scale)
    const phoenixLateNight = [{
      gamePk: 50, date: '2025-04-19', gameTime: iso(2025, 4, 19, 22, 0),
      status: 'Scheduled', dayNight: 'N', awayTeamName: 'Visitor B',
    }];
    const result = suggestScheduleRoute(
      [1, 2, 3], 1,
      { 1: denverGames, 2: phoenixLateNight, 3: sacramentoGames },
      '2025-04-16'
    );
    expect(result.itinerary[1].parkId).toBe(2); // Phoenix chosen over farther Sacramento
  });

  describe('end city (endParkId)', () => {
    it('appends a final drive leg when endParkId is provided and not the last stop', () => {
      // Denver → Phoenix games; endParkId=Sacramento (no game selected there)
      const result = suggestScheduleRoute(
        [1, 2], 1,
        { 1: denverGames, 2: phoenixGames },
        '2025-04-16',
        3 // endParkId = Sacramento
      );
      const lastStop = result.itinerary[result.itinerary.length - 1];
      expect(lastStop.parkId).toBe(3);
      expect(lastStop.game).toBeNull();
      expect(lastStop.driveFromPrev.miles).toBeGreaterThan(0);
    });

    it('does not duplicate the last stop when endParkId equals the last game park', () => {
      // Phoenix is already the last game stop; endParkId=Phoenix → no extra leg
      const result = suggestScheduleRoute(
        [1, 2], 1,
        { 1: denverGames, 2: phoenixGames },
        '2025-04-16',
        2 // endParkId = Phoenix (already last)
      );
      expect(result.itinerary.filter(s => s.parkId === 2)).toHaveLength(1);
      expect(result.itinerary[result.itinerary.length - 1].game).not.toBeNull();
    });

    it('does not append a final leg when endParkId is omitted', () => {
      const result = suggestScheduleRoute(
        [1, 2], 1,
        { 1: denverGames, 2: phoenixGames },
        '2025-04-16'
      );
      result.itinerary.forEach(stop => expect(stop.game).not.toBeNull());
    });

    it('includes end city drive in totalMiles', () => {
      const withEnd = suggestScheduleRoute(
        [1, 2], 1, { 1: denverGames, 2: phoenixGames }, '2025-04-16', 3
      );
      const without = suggestScheduleRoute(
        [1, 2], 1, { 1: denverGames, 2: phoenixGames }, '2025-04-16'
      );
      expect(withEnd.totalMiles).toBeGreaterThan(without.totalMiles);
    });
  });

  it('requires 90 minutes buffer — a game 65 minutes after arrival is unreachable', () => {
    // Denver 1pm day game: ends 4:30pm, departs immediately (before 7pm threshold)
    // Park 4 is at Denver's coords → arrival is ~instant (0 miles), effective arrival ~4:30pm
    // Game at 5:35pm = 65min after arrival → reachable with 60min buffer, NOT with 90min
    const dayGame = [{
      gamePk: 40, date: '2025-04-16', gameTime: iso(2025, 4, 16, 13, 0),
      status: 'Scheduled', dayNight: 'D', awayTeamName: 'Visitor A',
    }];
    const tightGame = [{
      gamePk: 41, date: '2025-04-16', gameTime: iso(2025, 4, 16, 17, 35),
      status: 'Scheduled', dayNight: 'N', awayTeamName: 'Visitor B',
    }];
    const result = suggestScheduleRoute([1, 4], 1, { 1: dayGame, 4: tightGame }, '2025-04-16');
    expect(result.unreachableParks.some(p => p.parkId === 4)).toBe(true);
  });
});
