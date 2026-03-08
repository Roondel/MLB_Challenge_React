import { Navigation, AlertTriangle, Calendar, RefreshCw } from 'lucide-react';
import { formatGameDate, formatGameTime } from '../../services/mlbApi';
import { PARK_BY_ID } from '../../data/parks';

export default function RoutePreview({ routeResult, stopNotes, onNoteChange, onReplan }) {
  if (!routeResult || !routeResult.itinerary || routeResult.itinerary.length === 0) {
    if (routeResult?.unreachableParks?.length > 0) {
      return (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Suggested Route
          </h3>
          <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-xs text-red-400 font-medium mb-2">Could not schedule:</p>
            {routeResult.unreachableParks.map(p => (
              <p key={p.parkId} className="text-xs text-red-400/80 mt-1">
                {p.teamName} — {p.reason}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  const gameStops = routeResult.itinerary.filter(s => s.game);
  const firstDay = gameStops[0]?.game.date;
  const lastDay = gameStops[gameStops.length - 1]?.game.date;
  const daySpan = firstDay && lastDay
    ? Math.ceil((new Date(lastDay) - new Date(firstDay)) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Suggested Route
        </h3>
        <div className="flex items-center gap-3">
          {onReplan && (
            <button
              onClick={onReplan}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              <RefreshCw size={11} />
              Re-plan
            </button>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Navigation size={14} />
            ~{routeResult.totalMiles.toLocaleString()} miles
          </div>
        </div>
      </div>

      {daySpan > 0 && (
        <p className="text-xs text-gray-600 mb-4">
          {formatGameDate(firstDay)} — {formatGameDate(lastDay)} ({daySpan} day{daySpan !== 1 ? 's' : ''})
        </p>
      )}

      {/* Warnings */}
      {routeResult.warnings.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg space-y-1">
          {routeResult.warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-400 flex items-center gap-1.5">
              <AlertTriangle size={12} className="flex-shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {/* Itinerary */}
      <div className="space-y-0">
        {routeResult.itinerary.map((stop, i) => (
          <div key={stop.parkId} className="flex gap-3">
            {/* Timeline */}
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 0 ? 'bg-accent text-white' : 'bg-dark-700 text-gray-400'
              }`}>
                {i + 1}
              </div>
              {i < routeResult.itinerary.length - 1 && (
                <div className="w-px flex-1 bg-dark-600 my-1" />
              )}
            </div>
            {/* Content */}
            <div className={`flex-1 ${i < routeResult.itinerary.length - 1 ? 'pb-4' : ''}`}>
              <p className="font-medium text-sm">{stop.parkName}</p>
              {stop.game ? (
                <>
                  <p className="text-xs text-gray-500">
                    {stop.teamName} vs {stop.game.awayTeamName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-accent font-medium">
                      <Calendar size={11} />
                      {formatGameDate(stop.game.date)} at {formatGameTime(stop.game.gameTime, PARK_BY_ID[stop.parkId]?.timezone)}
                    </span>
                    <span className={`text-xs ${stop.game.dayNight === 'D' ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {stop.game.dayNight === 'D' ? '🔆 Day' : '🌙 Night'}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-xs text-gray-500 italic">Drive home destination</span>
              )}
              {stop.driveFromPrev && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {stop.driveFromPrev.miles} mi · ~{stop.driveFromPrev.driveTime} drive
                  {stop.driveFromPrev.overnightStops > 0 && (
                    <span className="ml-1 text-yellow-500">
                      · {stop.driveFromPrev.overnightStops} overnight stop{stop.driveFromPrev.overnightStops > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              )}
              {onNoteChange && (
                <textarea
                  value={stopNotes?.[stop.parkId] || ''}
                  onChange={e => onNoteChange(stop.parkId, e.target.value)}
                  placeholder="Transport, accommodation, food, anything..."
                  rows={2}
                  className="mt-2 w-full bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent resize-y"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Unreachable parks */}
      {routeResult.unreachableParks.length > 0 && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-xs text-red-400 font-medium mb-1">Could not schedule:</p>
          {routeResult.unreachableParks.map(p => (
            <p key={p.parkId} className="text-xs text-red-400/80 mt-1">
              {p.teamName} — {p.reason}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-dark-700 rounded-lg">
        <p className="text-xs text-gray-500">
          Route optimized for schedule feasibility. Game times shown in each venue's local time zone.
        </p>
      </div>
    </div>
  );
}
