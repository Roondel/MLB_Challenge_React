import { useState } from 'react';
import { PARKS, PARK_BY_ID } from '../data/parks';
import { fetchHomeGamesByPark } from '../services/mlbApi';
import { suggestScheduleRoute } from '../services/tripPlanner';
import { useVisits } from '../hooks/useVisits';
import { useToast } from '../components/layout/Toast';
import TripForm from '../components/trip/TripForm';
import AvailableGames from '../components/trip/AvailableGames';
import RoutePreview from '../components/trip/RoutePreview';

export default function TripPlannerPage() {
  const { visitedParks } = useVisits();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gamesByPark, setGamesByPark] = useState(null);
  const [selectedParks, setSelectedParks] = useState([]);
  const [routeResult, setRouteResult] = useState(null);
  const [searchParams, setSearchParams] = useState(null);

  const handleSearch = async ({ startDate, endDate, startCity }) => {
    setLoading(true);
    setError(null);
    setGamesByPark(null);
    setSelectedParks([]);
    setRouteResult(null);
    setSearchParams({ startDate, endDate, startCity });

    try {
      const results = await fetchHomeGamesByPark(startDate, endDate);

      // Filter out already-visited parks (optional — user can re-enable)
      const filtered = {};
      Object.entries(results).forEach(([parkId, games]) => {
        filtered[Number(parkId)] = games;
      });

      setGamesByPark(filtered);
      const parkCount = Object.keys(filtered).length;
      addToast(`Found ${parkCount} parks with home games`, 'success');
    } catch (err) {
      setError(err.message || 'Failed to fetch schedule. Please try again.');
      addToast('Failed to fetch schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePark = (parkId) => {
    setSelectedParks(prev => {
      const next = prev.includes(parkId)
        ? prev.filter(id => id !== parkId)
        : [...prev, parkId];

      // Auto-generate route when parks change
      if (next.length > 0) {
        const startPark = searchParams?.startCity
          ? PARKS.find(p => `${p.city}, ${p.state}` === searchParams.startCity)
          : PARK_BY_ID[next[0]];
        const result = suggestScheduleRoute(
          next,
          startPark?.teamId || next[0],
          gamesByPark,
          searchParams.startDate
        );
        setRouteResult(result);
      } else {
        setRouteResult(null);
      }

      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Trip Planner</h2>
        <p className="text-gray-500 text-sm mt-1">Find home games and plan your ballpark road trip</p>
      </div>

      <TripForm onSearch={handleSearch} loading={loading} />

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {gamesByPark && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AvailableGames
            gamesByPark={gamesByPark}
            selectedParks={selectedParks}
            onTogglePark={handleTogglePark}
          />
          <RoutePreview routeResult={routeResult} />
        </div>
      )}

      {loading && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-12 flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
          <p className="text-gray-500 text-sm">Searching MLB schedule...</p>
        </div>
      )}

      {!gamesByPark && !loading && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-10 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-dark-700 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm font-medium">Plan your ballpark road trip</p>
            <p className="text-gray-600 text-xs mt-1">
              {visitedParks.length > 0
                ? `You've visited ${visitedParks.length} parks — ${30 - visitedParks.length} to go!`
                : 'Enter your travel dates to find home games across all 30 ballparks'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
