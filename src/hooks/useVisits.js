import { useApp } from '../context/AppContext';

export function useVisits() {
  const { state, dispatch } = useApp();

  const addVisit = (visit) => {
    dispatch({
      type: 'ADD_VISIT',
      payload: {
        visitId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...visit,
      },
    });
  };

  const updateVisit = (visitId, updates) => {
    dispatch({ type: 'UPDATE_VISIT', payload: { visitId, ...updates } });
  };

  const deleteVisit = (visitId) => {
    dispatch({ type: 'DELETE_VISIT', payload: visitId });
  };

  const getVisitByParkId = (parkId) => {
    return state.visits.find(v => v.parkId === parkId);
  };

  const isVisited = (parkId) => {
    return state.visits.some(v => v.parkId === parkId);
  };

  const visitedCount = state.visits.length;

  const visitedParks = state.visits.map(v => v.parkId);

  const uniqueStates = [...new Set(
    state.visits.map(v => {
      const park = state.parks.find(p => p.teamId === v.parkId);
      return park?.state;
    }).filter(Boolean)
  )];

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
    uniqueStates,
    averageRating,
  };
}
