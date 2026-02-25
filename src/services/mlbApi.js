const BASE_URL = 'https://statsapi.mlb.com/api/v1';

export async function fetchSchedule(startDate, endDate) {
  const url = `${BASE_URL}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API error: ${res.status}`);
  const data = await res.json();

  const games = (data.dates || []).flatMap(d =>
    d.games.map(g => ({
      gamePk: g.gamePk,
      date: d.date,
      gameTime: g.gameDate,
      dayNight: g.dayNight,
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

export function formatGameDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatGameTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
