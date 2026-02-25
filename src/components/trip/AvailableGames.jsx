import { PARK_BY_ID } from '../../data/parks';
import { formatGameDate, formatGameTime } from '../../services/mlbApi';

export default function AvailableGames({ gamesByPark, selectedParks, onTogglePark }) {
  const parkIds = Object.keys(gamesByPark).map(Number).sort((a, b) => {
    const parkA = PARK_BY_ID[a];
    const parkB = PARK_BY_ID[b];
    return (parkA?.teamName || '').localeCompare(parkB?.teamName || '');
  });

  if (parkIds.length === 0) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 text-center">
        <p className="text-gray-500">No home games found in this date range</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Available Parks ({parkIds.length})
        </h3>
        <span className="text-xs text-gray-500">{selectedParks.length} selected</span>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {parkIds.map(parkId => {
          const park = PARK_BY_ID[parkId];
          const games = gamesByPark[parkId];
          const isSelected = selectedParks.includes(parkId);

          return (
            <button
              key={parkId}
              onClick={() => onTogglePark(parkId)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-accent bg-accent/10'
                  : 'border-dark-600 hover:border-dark-500 bg-dark-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={`https://www.mlbstatic.com/team-logos/${parkId}.svg`}
                  alt={park?.abbreviation}
                  className="w-8 h-8"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{park?.venueName}</p>
                  <p className="text-xs text-gray-500">{park?.teamName} &middot; {park?.city}, {park?.state}</p>
                </div>
                <span className="text-xs text-gray-500">{games.length} games</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {games.slice(0, 6).map(g => (
                  <span
                    key={g.gamePk}
                    className="px-2 py-0.5 bg-dark-800 rounded text-xs text-gray-400"
                  >
                    {formatGameDate(g.date)} {formatGameTime(g.gameTime)}
                  </span>
                ))}
                {games.length > 6 && (
                  <span className="px-2 py-0.5 text-xs text-gray-500">+{games.length - 6} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
