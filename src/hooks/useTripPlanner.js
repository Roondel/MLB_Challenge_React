import { useState, useRef } from 'react';
import { PARKS } from '../data/parks';
import { fetchHomeGamesByPark } from '../services/mlbApi';
import { suggestScheduleRoute } from '../services/tripPlanner';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/layout/Toast';
import {
  saveTrip as apiSaveTrip,
  deleteTrip as apiDeleteTrip,
} from '../services/api';

export function useTripPlanner() {
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
  const [endParkId, setEndParkId] = useState(null);
  const [stopNotes, setStopNotes] = useState({});
  const [loadedTripId, setLoadedTripId] = useState(null);
  const notesSaveTimerRef = useRef(null);

  const recomputeRoute = (parks, endId) => {
    if (parks.length === 0) { setRouteResult(null); return; }
    const startParkId = searchParams?.startCity
      ? PARKS.find(p => `${p.city}, ${p.state}` === searchParams.startCity)?.teamId
      : null;
    setRouteResult(suggestScheduleRoute(parks, startParkId, gamesByPark, searchParams.startDate, endId));
  };

  const handleSearch = async ({ startDate, endDate, startCity }, { preserveTrip = false } = {}) => {
    setLoading(true);
    setError(null);
    setGamesByPark(null);
    setSelectedParks([]);
    setRouteResult(null);
    setShowSaveInput(false);
    setEndParkId(null);
    if (!preserveTrip) {
      setStopNotes({});
      setLoadedTripId(null);
    }
    setSearchParams({ startDate, endDate, startCity });

    try {
      const results = await fetchHomeGamesByPark(startDate, endDate);
      const filtered = {};
      Object.entries(results).forEach(([parkId, games]) => {
        filtered[Number(parkId)] = games;
      });
      setGamesByPark(filtered);
      addToast(`Found ${Object.keys(filtered).length} parks with home games`, 'success');

      if (startCity) {
        const startPark = PARKS.find(p => `${p.city}, ${p.state}` === startCity);
        if (startPark && filtered[startPark.teamId]) {
          const initial = [startPark.teamId];
          setSelectedParks(initial);
          setRouteResult(suggestScheduleRoute(initial, startPark.teamId, filtered, startDate, endParkId));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch schedule. Please try again.');
      addToast('Failed to fetch schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReplan = () => {
    if (!searchParams) return;
    handleSearch(searchParams, { preserveTrip: true });
  };

  const handleTogglePark = (parkId) => {
    setSelectedParks(prev => {
      const next = prev.includes(parkId)
        ? prev.filter(id => id !== parkId)
        : [...prev, parkId];
      recomputeRoute(next, endParkId);
      setShowSaveInput(false);
      return next;
    });
  };

  const handleSelectAll = (selectAll) => {
    const allParkIds = Object.keys(gamesByPark).map(Number);
    const next = selectAll ? allParkIds : [];
    setSelectedParks(next);
    recomputeRoute(next, endParkId);
    setShowSaveInput(false);
  };

  const handleNoteChange = (parkId, text) => {
    const updated = { ...stopNotes, [parkId]: text };
    setStopNotes(updated);

    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = setTimeout(async () => {
      if (!loadedTripId) return;
      const payload = { tripId: loadedTripId, stopNotes: updated };
      dispatch({ type: 'UPDATE_TRIP', payload });
      const trip = state.tripPlans.find(t => t.tripId === loadedTripId);
      if (trip) {
        try {
          await apiSaveTrip({ ...trip, stopNotes: updated });
        } catch (err) {
          console.error('Failed to save notes:', err);
        }
      }
      addToast('Notes saved', 'success');
    }, 800);
  };

  const handleSaveTrip = async () => {
    const name = tripName.trim() || `Trip ${new Date().toLocaleDateString()}`;
    const tripId = loadedTripId || Date.now().toString();
    const tripPayload = {
      tripId,
      name,
      savedAt:      new Date().toISOString(),
      startDate:    searchParams.startDate,
      endDate:      searchParams.endDate,
      startCity:    searchParams.startCity,
      selectedParks,
      routeResult,
      stopNotes,
    };
    dispatch({ type: 'SAVE_TRIP', payload: tripPayload });
    if (!loadedTripId) setLoadedTripId(tripId);
    setTripName('');
    setShowSaveInput(false);
    addToast(`"${name}" saved`, 'success');
    try {
      await apiSaveTrip(tripPayload);
    } catch (err) {
      console.error('Failed to save trip to API:', err);
    }
  };

  const handleLoadTrip = (trip) => {
    setSearchParams({ startDate: trip.startDate, endDate: trip.endDate, startCity: trip.startCity });
    setSelectedParks(trip.selectedParks);
    setRouteResult(trip.routeResult);
    setStopNotes(trip.stopNotes || {});
    setLoadedTripId(trip.tripId);
    setGamesByPark(null);
    addToast(`Loaded "${trip.name}"`, 'success');
  };

  const handleDeleteTrip = async (tripId) => {
    dispatch({ type: 'DELETE_TRIP', payload: tripId });
    addToast('Trip deleted', 'success');
    try {
      await apiDeleteTrip(tripId);
    } catch (err) {
      console.error('Failed to delete trip from API:', err);
    }
  };

  return {
    loading, error, gamesByPark, selectedParks, routeResult,
    searchParams, tripName, showSaveInput, endParkId, stopNotes, loadedTripId,
    tripPlans: state.tripPlans,
    setEndParkId, setTripName, setShowSaveInput,
    handleSearch, handleReplan, recomputeRoute,
    handleTogglePark, handleSelectAll, handleNoteChange,
    handleSaveTrip, handleLoadTrip, handleDeleteTrip,
  };
}
