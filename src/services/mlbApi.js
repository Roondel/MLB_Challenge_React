const BASE_URL = 'https://statsapi.mlb.com/api/v1';

async function fetchSchedule(startDate, endDate) {
  const url = `${BASE_URL}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API error: ${res.status}`);
  const data = await res.json();

  const games = (data.dates || []).flatMap(d =>
    d.games.map(g => ({
      gamePk: g.gamePk,
      date: d.date,
      gameTime: g.gameDate,
      dayNight: g.dayNight === 'day' ? 'D' : g.dayNight === 'night' ? 'N' : g.dayNight,
      homeTeamId: g.teams.home.team.id,
      homeTeamName: g.teams.home.team.name,
      awayTeamId: g.teams.away.team.id,
      awayTeamName: g.teams.away.team.name,
      venueId: g.venue.id,
      venueName: g.venue.name,
      status: g.status?.detailedState || 'Scheduled',
    }))
  );

  return games;
}

export async function fetchHomeGamesByPark(startDate, endDate) {
  const games = await fetchSchedule(startDate, endDate);

  const byPark = {};
  games.forEach(g => {
    if (!byPark[g.homeTeamId]) byPark[g.homeTeamId] = [];
    byPark[g.homeTeamId].push(g);
  });

  return byPark;
}

export async function fetchGameForParkOnDate(teamId, date) {
  const url = `${BASE_URL}/schedule?sportId=1&startDate=${date}&endDate=${date}&teamId=${teamId}&gameType=R`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const games = (data.dates || []).flatMap(d => d.games);
    const game = games.find(g => g.teams.home.team.id === teamId);
    if (!game) return null;
    return {
      gamePk: game.gamePk,
      status: game.status?.detailedState || 'Scheduled',
      gameTime: game.gameDate,
      homeTeamId: game.teams.home.team.id,
      homeTeamName: game.teams.home.team.name,
      homeScore: game.teams.home.score ?? null,
      awayTeamId: game.teams.away.team.id,
      awayTeamName: game.teams.away.team.name,
      awayScore: game.teams.away.score ?? null,
    };
  } catch {
    return null;
  }
}

function wmoDescription(code) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 65) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Showers';
  if (code <= 99) return 'Thunderstorms';
  return 'Unknown';
}

export async function fetchWeatherForPark(lat, lng, date) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const tempF = data.daily?.temperature_2m_max?.[0];
    const code = data.daily?.weathercode?.[0];
    if (tempF == null) return null;
    return { tempF: Math.round(tempF), condition: wmoDescription(code) };
  } catch {
    return null;
  }
}

export function formatGameDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatGameTime(isoStr, timezone) {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}
