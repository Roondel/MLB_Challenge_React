import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { PARKS } from '../data/parks';
import {
  API_AVAILABLE,
  fetchAllVisits,
  fetchAllTrips,
} from '../services/api';

const AppContext = createContext(null);

function loadFromStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

// Seed from localStorage so the UI shows stale-but-real data instantly
// while the initial API fetch runs, then SET_VISITS/SET_TRIPS replaces it.
const initialState = {
  parks: PARKS,
  visits: loadFromStorage('ballpark_visits', []),
  tripPlans: loadFromStorage('ballpark_trips', []),
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VISITS':
      return { ...state, visits: action.payload };
    case 'SET_TRIPS':
      return { ...state, tripPlans: action.payload };
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

  // Start as loaded when running without API (localStorage-only mode)
  const [visitsLoaded, setVisitsLoaded] = useState(!API_AVAILABLE);
  const [tripsLoaded,  setTripsLoaded]  = useState(!API_AVAILABLE);

  // On mount: fetch authoritative data from the API and replace the localStorage seed
  useEffect(() => {
    if (!API_AVAILABLE) return;
    fetchAllVisits()
      .then(visits => {
        dispatch({ type: 'SET_VISITS', payload: visits });
        localStorage.setItem('ballpark_visits', JSON.stringify(visits));
      })
      .catch(err => console.error('Failed to load visits from API:', err))
      .finally(() => setVisitsLoaded(true));
  }, []);

  useEffect(() => {
    if (!API_AVAILABLE) return;
    fetchAllTrips()
      .then(trips => {
        dispatch({ type: 'SET_TRIPS', payload: trips });
        localStorage.setItem('ballpark_trips', JSON.stringify(trips));
      })
      .catch(err => console.error('Failed to load trips from API:', err))
      .finally(() => setTripsLoaded(true));
  }, []);

  // Mirror to localStorage on every change — serves as warm cache for next
  // cold load and as a fallback if the API is temporarily unavailable.
  useEffect(() => {
    localStorage.setItem('ballpark_visits', JSON.stringify(state.visits));
  }, [state.visits]);

  useEffect(() => {
    localStorage.setItem('ballpark_trips', JSON.stringify(state.tripPlans));
  }, [state.tripPlans]);

  return (
    <AppContext.Provider value={{ state, dispatch, visitsLoaded, tripsLoaded }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
