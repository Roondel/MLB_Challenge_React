import { createContext, useContext, useReducer, useEffect } from 'react';
import { PARKS } from '../data/parks';

const AppContext = createContext(null);

function loadFromStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

const initialState = {
  parks: PARKS,
  visits: loadFromStorage('ballpark_visits', []),
  tripPlans: loadFromStorage('ballpark_trips', []),
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_VISIT':
      return { ...state, visits: [...state.visits, action.payload] };
    case 'UPDATE_VISIT':
      return {
        ...state,
        visits: state.visits.map(v =>
          v.visitId === action.payload.visitId ? { ...v, ...action.payload } : v
        ),
      };
    case 'DELETE_VISIT':
      return {
        ...state,
        visits: state.visits.filter(v => v.visitId !== action.payload),
      };
    case 'SAVE_TRIP':
      return { ...state, tripPlans: [...state.tripPlans, action.payload] };
    case 'UPDATE_TRIP':
      return {
        ...state,
        tripPlans: state.tripPlans.map(t =>
          t.tripId === action.payload.tripId ? { ...t, ...action.payload } : t
        ),
      };
    case 'DELETE_TRIP':
      return {
        ...state,
        tripPlans: state.tripPlans.filter(t => t.tripId !== action.payload),
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist visits and trips to localStorage on change
  useEffect(() => {
    localStorage.setItem('ballpark_visits', JSON.stringify(state.visits));
  }, [state.visits]);

  useEffect(() => {
    localStorage.setItem('ballpark_trips', JSON.stringify(state.tripPlans));
  }, [state.tripPlans]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
