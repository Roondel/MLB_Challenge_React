import { useState } from 'react';
import { Trash2, FolderOpen } from 'lucide-react';
import { PARKS, PARK_BY_ID } from '../data/parks';
import { fetchHomeGamesByPark } from '../services/mlbApi';
import { suggestScheduleRoute } from '../services/tripPlanner';
import { useVisits } from '../hooks/useVisits';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/layout/Toast';
import {
  API_AVAILABLE,
  saveTrip as apiSaveTrip,
  deleteTrip as apiDeleteTrip,
} from '../services/api';
import TripForm from '../components/trip/TripForm';
import AvailableGames from '../components/trip/AvailableGames';
import RoutePreview from '../components/trip/RoutePreview';

export default function TripPlannerPage() {
  const { visitedParks } = useVisits();
  const { state, dispatch } = useApp();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gamesByPark, setGamesByPark] = useState(null);
  const [selectedParks, setSelectedParks] = useState([]);
  const [routeResult, setRouteResult] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [tripName, setTripName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSearch = async ({ startDate, endDate, startCity }) => {
    setLoading(true);
    setError(null);
    setGamesByPark(null);
    setSelectedParks([]);
    setRouteResult(null);
    setShowSaveInput(false);
    setSearchParams({ startDate, endDate, startCity });

    try {
      const results = await fetchHomeGamesByPark(startDate, endDate);
      const filtered = {};
      Object.entries(results).forEach(([parkId, games]) => {
        filtered[Number(parkId)] = games;
      });
      setGamesByPark(filtered);
      addToast(`Found ${Object.keys(filtered).length} parks with home games`, 'success');
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

      setShowSaveInput(false);
      return next;
    });
  };

  const handleSaveTrip = async () => {
    const name = tripName.trim() || `Trip ${new Date().toLocaleDateString()}`;
    const tripPayload = {
      tripId:   Date.now().toString(),
      name,
      savedAt:  new Date().toISOString(),
      startDate: searchParams.startDate,
      endDate:   searchParams.endDate,
      startCity: searchParams.startCity,
      selectedParks,
      routeResult,
    };
    dispatch({ type: 'SAVE_TRIP', payload: tripPayload });
    setTripName('');
    setShowSaveInput(false);
    addToast(`"${name}" saved`, 'success');
    if (API_AVAILABLE) {
      try {
        await apiSaveTrip(tripPayload);
      } catch (err) {
        console.error('Failed to save trip to API:', err);
      }
    }
  };

  const handleLoadTrip = (trip) => {
    setSearchParams({ startDate: trip.startDate, endDate: trip.endDate, startCity: trip.startCity });
    setSelectedParks(trip.selectedParks);
    setRouteResult(trip.routeResult);
    setGamesByPark(null);
    addToast(`Loaded "${trip.name}"`, 'success');
  };

  const handleDeleteTrip = async (tripId) => {
    dispatch({ type: 'DELETE_TRIP', payload: tripId });
    addToast('Trip deleted', 'success');
    if (API_AVAILABLE) {
      try {
        await apiDeleteTrip(tripId);
      } catch (err) {
        console.error('Failed to delete trip from API:', err);
      }
    }
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

      {/* Save trip */}
      {routeResult && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
          {!showSaveInput ? (
            <button
              onClick={() => setShowSaveInput(true)}
              className="w-full py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save This Trip
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Trip name (optional)"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTrip()}
                className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleSaveTrip}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setShowSaveInput(false); setTripName(''); }}
                className="px-3 py-2 text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-12 flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
          <p className="text-gray-500 text-sm">Searching MLB schedule...</p>
        </div>
      )}

      {!gamesByPark && !loading && !routeResult && (
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

      {/* Saved trips */}
      {state.tripPlans.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Saved Trips</h3>
          {state.tripPlans.map(trip => (
            <div key={trip.tripId} className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{trip.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {trip.startDate} → {trip.endDate} · {trip.selectedParks.length} park{trip.selectedParks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => handleLoadTrip(trip)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
              >
                <FolderOpen size={13} />
                Load
              </button>
              <button
                onClick={() => handleDeleteTrip(trip.tripId)}
                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
