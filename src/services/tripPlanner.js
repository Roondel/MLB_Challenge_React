import { PARK_BY_ID } from '../data/parks';

// Haversine distance in miles between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// Estimate driving time string (rough: 60mph average)
export function estimateDriveTime(miles) {
  const total = (miles * ROAD_FACTOR) / DRIVE_SPEED_MPH;
  const hours = Math.floor(total);
  const minutes = Math.round((total - hours) * 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// --- Schedule-aware trip planner ---

const GAME_DURATION_MS  = 3.5 * 60 * 60 * 1000;
const BUFFER_BEFORE_MS  = 1.5 * 60 * 60 * 1000;
const DRIVE_SPEED_MPH   = 60;
// Roads are longer than straight-line distance. 1.4 approximates the
// typical US road/haversine ratio — gets drive times close to mapping
// apps without needing a routing API. For accurate times on specific
// routes use Google Maps Distance Matrix.
const ROAD_FACTOR       = 1.4;

// Human driving limits
const MAX_DAILY_DRIVE_HOURS  = 8;   // max driving hours per day
const DRIVING_START_HOUR     = 8;   // don't start before 8am
const DRIVING_END_HOUR       = 20;  // stop driving by 8pm
const OVERNIGHT_GAME_HOUR    = 19;  // games ending after 7pm → overnight rest before driving

// Distance penalty factor for anti-zigzag selection.
// Adds virtual time proportional to drive duration so nearby parks are
// preferred over far ones when game times are close. Tunable: increase
// if routes still feel zigzaggy, decrease if algorithm skips long jumps
// too aggressively.
const ZIGZAG_PENALTY = 2.0;

// Beam search width. K=3 tries 3 parallel routes at each step.
// Increase if routes still miss reachable parks; 3 is fast and effective.
const BEAM_WIDTH = 3;

const SKIP_STATUSES = new Set(['Cancelled', 'Postponed', 'Suspended']);

function driveHours(miles) {
  return (miles * ROAD_FACTOR) / DRIVE_SPEED_MPH;
}

/**
 * Returns the local clock hour (0–24 float) at `ms` in the given IANA timezone.
 * Falls back to the system clock when no timezone is provided (test compatibility).
 */
function getLocalHour(ms, tz) {
  if (!tz) {
    const d = new Date(ms);
    return d.getHours() + d.getMinutes() / 60;
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date(ms));
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return (h === 24 ? 0 : h) + m / 60;
}

/**
 * Returns the UTC timestamp for DRIVING_START_HOUR:00 on the local calendar date
 * of `ms` in `tz` (or the next local calendar date when nextDay=true).
 * Falls back to system-local setHours when no timezone is provided.
 */
function advanceToMorning(ms, tz, nextDay) {
  if (!tz) {
    const next = new Date(ms);
    if (nextDay) next.setDate(next.getDate() + 1);
    next.setHours(DRIVING_START_HOUR, 0, 0, 0);
    return next.getTime();
  }
  // Get the local calendar date at ms in tz (en-CA gives "YYYY-MM-DD")
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
  let [y, mo, d] = localDate.split('-').map(Number);
  if (nextDay) {
    const nd = new Date(Date.UTC(y, mo - 1, d + 1));
    y = nd.getUTCFullYear(); mo = nd.getUTCMonth() + 1; d = nd.getUTCDate();
  }
  // Derive UTC offset from noon-UTC on that date (stable across DST for US timezones)
  const noonUtc = Date.UTC(y, mo - 1, d, 12);
  const noonLocal = Math.floor(getLocalHour(noonUtc, tz));
  const utcOffset = noonLocal - 12; // local = UTC + offset
  return Date.UTC(y, mo - 1, d, DRIVING_START_HOUR - utcOffset);
}

/**
 * Compute wall-clock arrival time accounting for:
 * - Max MAX_DAILY_DRIVE_HOURS of driving per calendar day
 * - No driving between DRIVING_END_HOUR and DRIVING_START_HOUR next day
 * Uses the venue's IANA timezone so calculations are correct regardless of
 * the user's system clock (e.g. a UK user planning a US road trip).
 */
export function effectiveArrivalTime(departureMs, miles, timezone) {
  let timeMs = departureMs;
  let hoursLeft = driveHours(miles);

  while (hoursLeft > 0.01) {
    const currentHour = getLocalHour(timeMs, timezone);

    // Outside driving window — advance to next morning in the venue's timezone
    if (currentHour >= DRIVING_END_HOUR || currentHour < DRIVING_START_HOUR) {
      timeMs = advanceToMorning(timeMs, timezone, currentHour >= DRIVING_END_HOUR);
      continue;
    }

    // Drive as much as possible today (capped by daily limit and end-of-day)
    const hoursAvailableToday = Math.min(
      DRIVING_END_HOUR - currentHour,
      MAX_DAILY_DRIVE_HOURS
    );
    const driveNow = Math.min(hoursLeft, hoursAvailableToday);
    timeMs += driveNow * 3600 * 1000;
    hoursLeft -= driveNow;

    // Still more to drive — rest overnight
    if (hoursLeft > 0.01) {
      timeMs = advanceToMorning(timeMs, timezone, true);
    }
  }

  return timeMs;
}

/**
 * Earliest departure time after a game ends.
 * Evening games require overnight rest before driving.
 * Uses the venue's IANA timezone for the hour check.
 */
export function departureAfterGame(gameEndMs, timezone) {
  const hour = getLocalHour(gameEndMs, timezone);
  if (hour >= OVERNIGHT_GAME_HOUR) {
    return advanceToMorning(gameEndMs, timezone, true);
  }
  return gameEndMs;
}

/**
 * Count overnight stops required for a drive leg.
 */
export function overnightStopsForDrive(departureMs, miles, timezone) {
  const arrivalMs = effectiveArrivalTime(departureMs, miles, timezone);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    ...(timezone ? { timeZone: timezone } : {}),
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const depDate = new Date(fmt.format(new Date(departureMs)) + 'T00:00:00Z');
  const arrDate = new Date(fmt.format(new Date(arrivalMs)) + 'T00:00:00Z');
  return Math.round((arrDate - depDate) / (24 * 60 * 60 * 1000));
}

/**
 * Count how many parks in `remainingSet` have at least one reachable game
 * from `fromPark` after `fromTime`. Used for beam pruning.
 */
function computeReachableCount(fromPark, fromTime, remainingSet, sortedGames) {
  let count = 0;
  for (const parkId of remainingSet) {
    const targetPark = PARK_BY_ID[parkId];
    if (!targetPark) continue;
    const distance = haversine(fromPark.lat, fromPark.lng, targetPark.lat, targetPark.lng);
    const arrivalTime = effectiveArrivalTime(fromTime, distance, fromPark.timezone);
    const earliestGameStart = arrivalTime + BUFFER_BEFORE_MS;
    const game = sortedGames[parkId]?.find(g =>
      new Date(g.gameTime).getTime() >= earliestGameStart
    );
    if (game) count++;
  }
  return count;
}

export function suggestScheduleRoute(selectedParkIds, startParkId, gamesByPark, tripStartDate, endParkId) {
  if (selectedParkIds.length === 0) {
    return { route: [], totalMiles: 0, itinerary: [], unreachableParks: [], warnings: [] };
  }

  let currentPark = PARK_BY_ID[startParkId] || PARK_BY_ID[selectedParkIds[0]];

  // Compute trip start as DRIVING_START_HOUR on tripStartDate in the venue's
  // local timezone, so a UK user planning a US trip gets 8am CDT/EDT not 8am BST.
  const startTz = currentPark?.timezone;
  let currentTime = (() => {
    if (!startTz) {
      return new Date(`${tripStartDate}T${DRIVING_START_HOUR.toString().padStart(2, '0')}:00:00`).getTime();
    }
    const [sy, smo, sd] = tripStartDate.split('-').map(Number);
    return advanceToMorning(Date.UTC(sy, smo - 1, sd, 12), startTz, false);
  })();

  const remaining = new Set(selectedParkIds);
  const itinerary = [];
  const unreachableParks = [];
  const warnings = [];
  let totalMiles = 0;

  const sortedGames = {};
  for (const parkId of selectedParkIds) {
    const games = gamesByPark[parkId] || [];
    sortedGames[parkId] = games
      .filter(g => !SKIP_STATUSES.has(g.status) && g.gameTime && !isNaN(new Date(g.gameTime).getTime()))
      .sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime));
  }

  // If the starting city is one of the selected parks, always lock it in
  // as stop #1. The user said they're starting here — don't send them
  // elsewhere and back. Parks whose games fall before this first game
  // are genuinely unreachable and will be flagged as such.
  if (remaining.has(startParkId)) {
    const startGame = sortedGames[startParkId]?.find(g =>
      new Date(g.gameTime).getTime() >= currentTime + BUFFER_BEFORE_MS
    );

    remaining.delete(startParkId);

    if (startGame) {
      const gameStartMs = new Date(startGame.gameTime).getTime();
      const gameEndMs = gameStartMs + GAME_DURATION_MS;

      itinerary.push({
        parkId: startParkId,
        parkName: PARK_BY_ID[startParkId]?.venueName,
        teamName: PARK_BY_ID[startParkId]?.teamName,
        city: PARK_BY_ID[startParkId]?.city,
        state: PARK_BY_ID[startParkId]?.state,
        game: {
          gamePk: startGame.gamePk,
          date: startGame.date,
          gameTime: startGame.gameTime,
          dayNight: startGame.dayNight,
          awayTeamName: startGame.awayTeamName,
        },
        arrival: new Date(currentTime).toISOString(),
        gameEnd: new Date(gameEndMs).toISOString(),
        driveFromPrev: null,
      });

      currentTime = departureAfterGame(gameEndMs, PARK_BY_ID[startParkId]?.timezone);
    } else {
      const park = PARK_BY_ID[startParkId];
      unreachableParks.push({
        parkId: startParkId,
        parkName: park?.venueName || 'Unknown',
        teamName: park?.teamName || 'Unknown',
        reason: 'No home games at starting city in your date range',
      });
    }
  }

  // ── Beam search: maintain BEAM_WIDTH candidate routes in parallel ──────────
  // Each beam is an independent route state. At every step we expand all beams,
  // prune to BEAM_WIDTH survivors, and repeat until no park remains.

  // When no fixed start city is given, the user has no origin — treat the
  // first expansion step as 0-distance to all parks (they pick whichever
  // game they want to attend first, regardless of where it is).
  const noOrigin = !PARK_BY_ID[startParkId] && itinerary.length === 0;

  // Initialise one beam from the state after the start-park lock above.
  let beams = [{
    currentPark,
    currentTime,
    remaining: new Set(remaining),
    itinerary: [...itinerary],
    unreachableParks: [...unreachableParks],
    warnings: [...warnings],
    totalMiles,
    score: 0,
    _noOrigin: noOrigin,
  }];

  // Clear outer state — we'll restore from the winner at the end.
  remaining.clear();

  while (beams.some(b => b.remaining.size > 0)) {
    const nextBeams = [];

    for (const beam of beams) {
      if (beam.remaining.size === 0) {
        // Terminal beam — null out dedup keys so it is never merged with an
        // active beam that visits the same park this round.
        nextBeams.push({ ...beam, _lastParkId: null, _lastGamePk: null });
        continue;
      }

      let anyReachable = false;

      // Expand: generate one candidate next-beam per reachable park.
      for (const parkId of beam.remaining) {
        const targetPark = PARK_BY_ID[parkId];
        if (!targetPark) continue;

        // When there is no fixed origin (null startParkId, no start-lock),
        // treat the first stop as 0 drive distance — the user travels to
        // whichever first game they choose.
        const distance = beam._noOrigin ? 0 : haversine(
          beam.currentPark.lat, beam.currentPark.lng,
          targetPark.lat, targetPark.lng
        );
        const driveTz = beam.currentPark?.timezone;
        const arrivalTime = effectiveArrivalTime(beam.currentTime, distance, driveTz);
        const earliestGameStart = arrivalTime + BUFFER_BEFORE_MS;

        const game = sortedGames[parkId].find(g =>
          new Date(g.gameTime).getTime() >= earliestGameStart
        );
        if (!game) continue;

        anyReachable = true;

        const gameStartMs = new Date(game.gameTime).getTime();
        const driveTimeMs = driveHours(distance) * 3_600_000;
        const stepScore = gameStartMs + driveTimeMs * ZIGZAG_PENALTY;

        const gameEndMs = gameStartMs + GAME_DURATION_MS;
        const stops = overnightStopsForDrive(beam.currentTime, distance, driveTz);

        const newWarnings = [...beam.warnings];
        if (stops > 0) {
          const park = PARK_BY_ID[parkId];
          newWarnings.push(
            `Drive to ${park.city} requires ${stops} overnight stop${stops > 1 ? 's' : ''} (~${estimateDriveTime(distance)} of driving)`
          );
        }

        const newItinerary = [
          ...beam.itinerary,
          {
            parkId,
            parkName: PARK_BY_ID[parkId]?.venueName,
            teamName: PARK_BY_ID[parkId]?.teamName,
            city: PARK_BY_ID[parkId]?.city,
            state: PARK_BY_ID[parkId]?.state,
            game: {
              gamePk: game.gamePk,
              date: game.date,
              gameTime: game.gameTime,
              dayNight: game.dayNight,
              awayTeamName: game.awayTeamName,
            },
            arrival: new Date(arrivalTime).toISOString(),
            gameEnd: new Date(gameEndMs).toISOString(),
            driveFromPrev: beam.itinerary.length === 0 ? null : {
              miles: Math.round(distance),
              driveTime: estimateDriveTime(distance),
              driveTimeMs: driveHours(distance) * 3600 * 1000,
              overnightStops: stops,
            },
          },
        ];

        const newRemaining = new Set(beam.remaining);
        newRemaining.delete(parkId);

        nextBeams.push({
          currentPark: PARK_BY_ID[parkId],
          currentTime: departureAfterGame(gameEndMs, targetPark.timezone),
          remaining: newRemaining,
          itinerary: newItinerary,
          unreachableParks: beam.unreachableParks,
          warnings: newWarnings,
          totalMiles: beam.totalMiles + distance,
          score: beam.score + gameStartMs,
          _stepScore: stepScore,
          _totalStepScore: (beam._totalStepScore || 0) + stepScore,
          _lastParkId: parkId,
          _lastGamePk: game.gamePk,
        });
      }

      if (!anyReachable) {
        // This beam is stuck — flush remaining to unreachable.
        // Clear _lastParkId so the dedup step treats it as a terminal beam
        // and never merges it with an active beam that happened to visit the
        // same park in this round.
        const stuckBeam = {
          ...beam,
          _lastParkId: null,
          _lastGamePk: null,
          remaining: new Set(),
          unreachableParks: [
            ...beam.unreachableParks,
            ...[...beam.remaining].map(parkId => {
              const park = PARK_BY_ID[parkId];
              return {
                parkId,
                parkName: park?.venueName || 'Unknown',
                teamName: park?.teamName || 'Unknown',
                reason: 'No reachable games remaining in your date range',
              };
            }),
          ],
        };
        nextBeams.push(stuckBeam);
      }
    }

    // ── Prune to BEAM_WIDTH beams ────────────────────────────────────────────

    // 1. Deduplicate: if two beams chose the same (parkId, gamePk), keep the better one.
    const seen = new Map();
    const deduped = [];
    for (const beam of nextBeams) {
      const key = beam._lastParkId != null
        ? `${beam._lastParkId}:${beam._lastGamePk}`
        : null;
      if (key == null) {
        deduped.push(beam);
        continue;
      }
      if (!seen.has(key)) {
        seen.set(key, deduped.length);
        deduped.push(beam);
      } else {
        const existingIdx = seen.get(key);
        const existing = deduped[existingIdx];
        const existingReachable = computeReachableCount(
          existing.currentPark, existing.currentTime, existing.remaining, sortedGames
        );
        const newReachable = computeReachableCount(
          beam.currentPark, beam.currentTime, beam.remaining, sortedGames
        );
        if (newReachable > existingReachable ||
            (newReachable === existingReachable && (beam._totalStepScore || 0) < (existing._totalStepScore || 0))) {
          deduped[existingIdx] = beam;
        }
      }
    }

    // 2. Sort survivors: most reachable remaining parks first, then lowest total step score.
    deduped.sort((a, b) => {
      const ra = computeReachableCount(a.currentPark, a.currentTime, a.remaining, sortedGames);
      const rb = computeReachableCount(b.currentPark, b.currentTime, b.remaining, sortedGames);
      if (rb !== ra) return rb - ra;
      return (a._totalStepScore || 0) - (b._totalStepScore || 0);
    });

    beams = deduped.slice(0, BEAM_WIDTH);
  }

  // ── Select the winning beam ────────────────────────────────────────────────
  beams.sort((a, b) => {
    if (a.unreachableParks.length !== b.unreachableParks.length)
      return a.unreachableParks.length - b.unreachableParks.length;
    return (a._totalStepScore || 0) - (b._totalStepScore || 0);
  });
  const winner = beams[0];

  // Restore outer variables from winner so the rest of the function
  // (same-day warning, end-city leg, return statement) works unchanged.
  itinerary.length = 0;
  itinerary.push(...winner.itinerary);
  unreachableParks.length = 0;
  unreachableParks.push(...winner.unreachableParks);
  warnings.length = 0;
  warnings.push(...winner.warnings);
  totalMiles = winner.totalMiles;
  currentPark = winner.currentPark;
  currentTime = winner.currentTime;

  const gameDates = itinerary.filter(s => s.game).map(s => s.game.date);
  const uniqueDates = new Set(gameDates);
  if (uniqueDates.size < gameDates.length) {
    warnings.push('Multiple games on the same day — schedule will be tight');
  }

  if (unreachableParks.length > 0) {
    warnings.unshift(`${unreachableParks.length} park(s) could not be fit into the schedule`);
  }

  // Append optional end city leg
  if (endParkId && itinerary.length > 0 && itinerary[itinerary.length - 1].parkId !== endParkId) {
    const endPark = PARK_BY_ID[endParkId];
    if (endPark) {
      const distance = haversine(currentPark.lat, currentPark.lng, endPark.lat, endPark.lng);
      const stops = overnightStopsForDrive(currentTime, distance, currentPark.timezone);
      const arrivalMs = effectiveArrivalTime(currentTime, distance, currentPark.timezone);

      if (stops > 0) {
        warnings.push(
          `Drive home to ${endPark.city} requires ${stops} overnight stop${stops > 1 ? 's' : ''} (~${estimateDriveTime(distance)} of driving)`
        );
      }

      totalMiles += distance;
      itinerary.push({
        parkId: endParkId,
        parkName: endPark.venueName,
        teamName: endPark.teamName,
        city: endPark.city,
        state: endPark.state,
        game: null,
        arrival: new Date(arrivalMs).toISOString(),
        gameEnd: null,
        driveFromPrev: {
          miles: Math.round(distance),
          driveTime: estimateDriveTime(distance),
          driveTimeMs: driveHours(distance) * 3_600_000,
          overnightStops: stops,
        },
      });
    }
  }

  return {
    route: itinerary.map(s => s.parkId),
    totalMiles: Math.round(totalMiles),
    itinerary,
    unreachableParks,
    warnings,
  };
}
