import { PARK_BY_ID } from '../data/parks';

// Haversine distance in miles between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbor heuristic for route optimization
export function suggestRoute(availableParkIds, startParkId) {
  if (availableParkIds.length === 0) return { route: [], totalMiles: 0 };

  const route = [];
  const remaining = new Set(availableParkIds);
  let currentPark = PARK_BY_ID[startParkId];

  if (!currentPark) {
    // If start park isn't in our data, use the first available park
    const firstId = availableParkIds[0];
    currentPark = PARK_BY_ID[firstId];
    remaining.delete(firstId);
    route.push(firstId);
  }

  let totalMiles = 0;

  while (remaining.size > 0) {
    let nearest = null;
    let nearestDist = Infinity;

    for (const parkId of remaining) {
      const park = PARK_BY_ID[parkId];
      if (!park) continue;
      const dist = haversine(currentPark.lat, currentPark.lng, park.lat, park.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = parkId;
      }
    }

    if (nearest) {
      route.push(nearest);
      remaining.delete(nearest);
      totalMiles += nearestDist;
      currentPark = PARK_BY_ID[nearest];
    } else {
      break;
    }
  }

  return {
    route,
    totalMiles: Math.round(totalMiles),
    legs: route.map((parkId, i) => {
      const park = PARK_BY_ID[parkId];
      const prevPark = i === 0
        ? PARK_BY_ID[startParkId] || PARK_BY_ID[route[0]]
        : PARK_BY_ID[route[i - 1]];
      const distance = prevPark
        ? Math.round(haversine(prevPark.lat, prevPark.lng, park.lat, park.lng))
        : 0;
      return {
        parkId,
        parkName: park?.venueName,
        teamName: park?.teamName,
        city: park?.city,
        state: park?.state,
        distance,
      };
    }),
  };
}

// Estimate driving time (rough: 60mph average)
export function estimateDriveTime(miles) {
  const hours = Math.floor(miles / 60);
  const minutes = Math.round((miles / 60 - hours) * 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// --- Schedule-aware trip planner ---

const GAME_DURATION_MS = 3.5 * 60 * 60 * 1000;  // 3.5 hours
const BUFFER_BEFORE_MS = 1 * 60 * 60 * 1000;     // 1 hour pre-game buffer
const DRIVE_SPEED_MPH = 60;
const LONG_DRIVE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours

function driveTimeMs(miles) {
  return (miles / DRIVE_SPEED_MPH) * 3600 * 1000;
}

const SKIP_STATUSES = new Set(['Cancelled', 'Postponed', 'Suspended']);

/**
 * Schedule-aware greedy route planner.
 * Picks specific games at each park, ensuring drive time + buffer
 * fits between consecutive games.
 *
 * @param {number[]} selectedParkIds
 * @param {number} startParkId - team ID of the starting city's park
 * @param {Object} gamesByPark - { [teamId]: gameObject[] }
 * @param {string} tripStartDate - "YYYY-MM-DD"
 * @returns {ScheduleRouteResult}
 */
export function suggestScheduleRoute(selectedParkIds, startParkId, gamesByPark, tripStartDate) {
  if (selectedParkIds.length === 0) {
    return { route: [], totalMiles: 0, itinerary: [], unreachableParks: [], warnings: [] };
  }

  // Current position and time
  let currentPark = PARK_BY_ID[startParkId] || PARK_BY_ID[selectedParkIds[0]];
  let currentTime = new Date(`${tripStartDate}T08:00:00`).getTime(); // 8am local

  const remaining = new Set(selectedParkIds);
  const itinerary = [];
  const unreachableParks = [];
  const warnings = [];
  let totalMiles = 0;

  // Pre-sort games for each park chronologically, filter bad statuses and TBD times
  const sortedGames = {};
  for (const parkId of selectedParkIds) {
    const games = gamesByPark[parkId] || [];
    sortedGames[parkId] = games
      .filter(g => !SKIP_STATUSES.has(g.status) && g.gameTime && !isNaN(new Date(g.gameTime).getTime()))
      .sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime));
  }

  // Greedy loop: pick the next park+game with least wait time
  while (remaining.size > 0) {
    let best = null; // { parkId, game, arrivalTime, waitTime, distance, dtMs }

    for (const parkId of remaining) {
      const targetPark = PARK_BY_ID[parkId];
      if (!targetPark) continue;

      const distance = haversine(currentPark.lat, currentPark.lng, targetPark.lat, targetPark.lng);
      const dtMs = driveTimeMs(distance);
      const arrivalTime = currentTime + dtMs;
      const earliestGameStart = arrivalTime + BUFFER_BEFORE_MS;

      // Find earliest feasible game at this park
      const game = sortedGames[parkId].find(g =>
        new Date(g.gameTime).getTime() >= earliestGameStart
      );

      if (!game) continue; // no reachable game

      const waitTime = new Date(game.gameTime).getTime() - earliestGameStart;

      if (!best || waitTime < best.waitTime || (waitTime === best.waitTime && distance < best.distance)) {
        best = { parkId, game, arrivalTime, waitTime, distance, dtMs };
      }
    }

    if (!best) {
      // No remaining park has a reachable game
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

    // Accept this candidate
    remaining.delete(best.parkId);
    totalMiles += best.distance;

    const gameStartMs = new Date(best.game.gameTime).getTime();
    const gameEndMs = gameStartMs + GAME_DURATION_MS;

    // Warn about long drives
    if (best.dtMs > LONG_DRIVE_THRESHOLD_MS) {
      const park = PARK_BY_ID[best.parkId];
      warnings.push(`Long drive to ${park.city}: ~${estimateDriveTime(best.distance)}`);
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
        driveTimeMs: best.dtMs,
      },
    });

    // Depart after the game ends
    currentTime = gameEndMs;
    currentPark = PARK_BY_ID[best.parkId];
  }

  // Check for same-day games (tight schedule)
  const gameDates = itinerary.map(s => s.game.date);
  const uniqueDates = new Set(gameDates);
  if (uniqueDates.size < gameDates.length) {
    warnings.push('Multiple games on the same day — schedule will be tight');
  }

  if (unreachableParks.length > 0) {
    warnings.unshift(`${unreachableParks.length} park(s) could not be fit into the schedule`);
  }

  return {
    route: itinerary.map(s => s.parkId),
    totalMiles: Math.round(totalMiles),
    itinerary,
    unreachableParks,
    warnings,
  };
}
