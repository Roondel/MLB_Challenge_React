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
 * Compute wall-clock arrival time accounting for:
 * - Max MAX_DAILY_DRIVE_HOURS of driving per calendar day
 * - No driving between DRIVING_END_HOUR and DRIVING_START_HOUR next day
 */
export function effectiveArrivalTime(departureMs, miles) {
  let timeMs = departureMs;
  let hoursLeft = driveHours(miles);

  while (hoursLeft > 0.01) {
    const d = new Date(timeMs);
    const currentHour = d.getHours() + d.getMinutes() / 60;

    // Outside driving window — advance to next morning
    if (currentHour >= DRIVING_END_HOUR || currentHour < DRIVING_START_HOUR) {
      const next = new Date(timeMs);
      if (currentHour >= DRIVING_END_HOUR) next.setDate(next.getDate() + 1);
      next.setHours(DRIVING_START_HOUR, 0, 0, 0);
      timeMs = next.getTime();
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
      const next = new Date(timeMs);
      next.setDate(next.getDate() + 1);
      next.setHours(DRIVING_START_HOUR, 0, 0, 0);
      timeMs = next.getTime();
    }
  }

  return timeMs;
}

/**
 * Earliest departure time after a game ends.
 * Evening games require overnight rest before driving.
 */
export function departureAfterGame(gameEndMs) {
  const d = new Date(gameEndMs);
  const hour = d.getHours() + d.getMinutes() / 60;

  if (hour >= OVERNIGHT_GAME_HOUR) {
    const next = new Date(gameEndMs);
    next.setDate(next.getDate() + 1);
    next.setHours(DRIVING_START_HOUR, 0, 0, 0);
    return next.getTime();
  }

  return gameEndMs;
}

/**
 * Count overnight stops required for a drive leg.
 */
export function overnightStopsForDrive(departureMs, miles) {
  const arrivalMs = effectiveArrivalTime(departureMs, miles);
  const depDate = new Date(departureMs);
  const arrDate = new Date(arrivalMs);
  depDate.setHours(0, 0, 0, 0);
  arrDate.setHours(0, 0, 0, 0);
  const calendarDays = Math.round((arrDate - depDate) / (24 * 60 * 60 * 1000));
  return calendarDays;
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
    const arrivalTime = effectiveArrivalTime(fromTime, distance);
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
  let currentTime = new Date(`${tripStartDate}T${DRIVING_START_HOUR.toString().padStart(2, '0')}:00:00`).getTime();

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

      currentTime = departureAfterGame(gameEndMs);
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

  // Greedy loop: pick the next park+game with earliest game start time
  while (remaining.size > 0) {
    let best = null;

    for (const parkId of remaining) {
      const targetPark = PARK_BY_ID[parkId];
      if (!targetPark) continue;

      const distance = haversine(currentPark.lat, currentPark.lng, targetPark.lat, targetPark.lng);
      const arrivalTime = effectiveArrivalTime(currentTime, distance);
      const earliestGameStart = arrivalTime + BUFFER_BEFORE_MS;

      const game = sortedGames[parkId].find(g =>
        new Date(g.gameTime).getTime() >= earliestGameStart
      );

      if (!game) continue;

      const gameStartMs = new Date(game.gameTime).getTime();
      const driveTimeMs = driveHours(distance) * 3_600_000;
      const score = gameStartMs + driveTimeMs * ZIGZAG_PENALTY;

      if (!best || score < best.score || (score === best.score && driveTimeMs < best.driveTimeMs)) {
        best = { parkId, game, arrivalTime, gameStartMs, distance, driveTimeMs, score };
      }
    }

    if (!best) {
      for (const parkId of remaining) {
        const park = PARK_BY_ID[parkId];
        unreachableParks.push({
          parkId,
          parkName: park?.venueName || 'Unknown',
          teamName: park?.teamName || 'Unknown',
          reason: 'No reachable games remaining in your date range',
        });
      }
      break;
    }

    remaining.delete(best.parkId);
    totalMiles += best.distance;

    const gameEndMs = best.gameStartMs + GAME_DURATION_MS;

    const stops = overnightStopsForDrive(currentTime, best.distance);
    if (stops > 0) {
      const park = PARK_BY_ID[best.parkId];
      warnings.push(
        `Drive to ${park.city} requires ${stops} overnight stop${stops > 1 ? 's' : ''} (~${estimateDriveTime(best.distance)} of driving)`
      );
    }

    itinerary.push({
      parkId: best.parkId,
      parkName: PARK_BY_ID[best.parkId]?.venueName,
      teamName: PARK_BY_ID[best.parkId]?.teamName,
      city: PARK_BY_ID[best.parkId]?.city,
      state: PARK_BY_ID[best.parkId]?.state,
      game: {
        gamePk: best.game.gamePk,
        date: best.game.date,
        gameTime: best.game.gameTime,
        dayNight: best.game.dayNight,
        awayTeamName: best.game.awayTeamName,
      },
      arrival: new Date(best.arrivalTime).toISOString(),
      gameEnd: new Date(gameEndMs).toISOString(),
      driveFromPrev: itinerary.length === 0 ? null : {
        miles: Math.round(best.distance),
        driveTime: estimateDriveTime(best.distance),
        driveTimeMs: driveHours(best.distance) * 3600 * 1000,
        overnightStops: stops,
      },
    });

    currentTime = departureAfterGame(gameEndMs);
    currentPark = PARK_BY_ID[best.parkId];
  }

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
      const stops = overnightStopsForDrive(currentTime, distance);
      const arrivalMs = effectiveArrivalTime(currentTime, distance);

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
