import { PARK_BY_ID, getTeamLogoUrl } from '../../data/parks';
import { formatGameDate, formatGameTime } from '../../services/mlbApi';

export default function AvailableGames({ gamesByPark, selectedParks, onTogglePark, onSelectAll, onReset, startCityParkId }) {
  const allParkIds = Object.keys(gamesByPark).map(Number);
  const parkIds = [...allParkIds].sort((a, b) => {
    if (a === startCityParkId) return -1;
    if (b === startCityParkId) return 1;
    return (PARK_BY_ID[a]?.teamName || '').localeCompare(PARK_BY_ID[b]?.teamName || '');
  });
  const allSelected = allParkIds.length > 0 && allParkIds.every(id => selectedParks.includes(id));

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
        <div className="flex items-center gap-3">
          {selectedParks.length > 0 && (
            <button
              onClick={() => onReset?.()}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => onSelectAll?.(!allSelected)}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-gray-500">{selectedParks.length} selected</span>
        </div>
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
                <div className="w-8 h-8 flex-shrink-0 p-0.5">
                  <img
                    src={getTeamLogoUrl(parkId)}
                    alt={park?.abbreviation}
                    className="w-full h-full object-contain"
                  />
                </div>
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
                    {formatGameDate(g.date)} {formatGameTime(g.gameTime, park?.timezone)}
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
