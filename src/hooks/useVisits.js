import { useApp } from '../context/AppContext';
import {
  API_AVAILABLE,
  saveVisit as apiSaveVisit,
  deleteVisit as apiDeleteVisit,
} from '../services/api';

export function useVisits() {
  const { state, dispatch } = useApp();

  const addVisit = async (visit) => {
    const newVisit = {
      visitId:   crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...visit,
    };
    // Optimistic update — UI responds instantly
    dispatch({ type: 'ADD_VISIT', payload: newVisit });
    // Sync to backend (localStorage mirror ensures data is not lost on failure)
    if (API_AVAILABLE) {
      try {
        await apiSaveVisit(newVisit);
      } catch (err) {
        console.error('Failed to save visit to API:', err);
      }
    }
    return newVisit;
  };

  const updateVisit = async (visitId, updates) => {
    dispatch({ type: 'UPDATE_VISIT', payload: { visitId, ...updates } });
    if (API_AVAILABLE) {
      try {
        const current = state.visits.find(v => v.visitId === visitId);
        if (current) await apiSaveVisit({ ...current, ...updates });
      } catch (err) {
        console.error('Failed to update visit in API:', err);
      }
    }
  };

  const deleteVisit = async (visitId) => {
    // Capture parkId before dispatching (visit is removed from state on dispatch)
    const visit = state.visits.find(v => v.visitId === visitId);
    dispatch({ type: 'DELETE_VISIT', payload: visitId });
    if (API_AVAILABLE && visit) {
      try {
        await apiDeleteVisit(visit.parkId);
      } catch (err) {
        console.error('Failed to delete visit from API:', err);
      }
    }
  };

  const getVisitByParkId = (parkId) => {
    return state.visits.find(v => v.parkId === parkId);
  };

  const isVisited = (parkId) => {
    return state.visits.some(v => v.parkId === parkId);
  };

  const visitedCount = state.visits.length;

  const visitedParks = state.visits.map(v => v.parkId);

  const averageRating = state.visits.length > 0
    ? (state.visits.reduce((sum, v) => sum + (v.rating || 0), 0) / state.visits.length).toFixed(1)
    : 0;

  return {
    visits: state.visits,
    addVisit,
    updateVisit,
    deleteVisit,
    getVisitByParkId,
    isVisited,
    visitedCount,
    visitedParks,
    averageRating,
  };
}
