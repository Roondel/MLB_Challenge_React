import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    // Pass through all real exports (including API_AVAILABLE, AUTH_EXPIRED, etc.)
    // so Vitest's strict named-export checking is satisfied.
    ...actual,
    // Never-resolving promises prevent SET_VISITS/SET_TRIPS from firing and
    // wiping state added by dispatch in the reducer tests below.
    fetchAllVisits: vi.fn().mockReturnValue(new Promise(() => {})),
    fetchAllTrips:  vi.fn().mockReturnValue(new Promise(() => {})),
  };
});

// Mock useAuth so AppContext can render without a real Cognito configuration.
// isAuthenticated=true and loading=false simulate a signed-in user.
vi.mock('../AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true, loading: false })),
  AuthProvider: ({ children }) => children,
}));

import { AppProvider, useApp } from '../AppContext.jsx';

const wrapper = ({ children }) => <AppProvider>{children}</AppProvider>;

beforeEach(() => {
  localStorage.clear();
});

describe('AppContext reducer', () => {
  it('SET_VISITS replaces the entire visits array', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const visits = [{ visitId: '1', parkId: 109, visitDate: '2025-07-04' }];

    act(() => result.current.dispatch({ type: 'SET_VISITS', payload: visits }));

    expect(result.current.state.visits).toEqual(visits);
  });

  it('SET_TRIPS replaces the entire tripPlans array', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const trips = [{ tripId: 'abc', name: 'Test' }];

    act(() => result.current.dispatch({ type: 'SET_TRIPS', payload: trips }));

    expect(result.current.state.tripPlans).toEqual(trips);
  });

  it('ADD_VISIT appends a visit', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const visit = { visitId: '1', parkId: 109, visitDate: '2025-07-04' };

    act(() => result.current.dispatch({ type: 'ADD_VISIT', payload: visit }));

    expect(result.current.state.visits).toContainEqual(visit);
    expect(result.current.state.visits).toHaveLength(1);
  });

  it('UPDATE_VISIT merges fields by visitId while preserving other fields', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const visit = { visitId: '1', parkId: 109, rating: 3, personalNote: 'Good' };

    act(() => result.current.dispatch({ type: 'ADD_VISIT', payload: visit }));
    act(() => result.current.dispatch({ type: 'UPDATE_VISIT', payload: { visitId: '1', rating: 5 } }));

    const updated = result.current.state.visits[0];
    expect(updated.rating).toBe(5);
    expect(updated.parkId).toBe(109);       // unchanged
    expect(updated.personalNote).toBe('Good'); // unchanged
  });

  it('UPDATE_VISIT does not touch visits with different visitId', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({ type: 'ADD_VISIT', payload: { visitId: '1', parkId: 109, rating: 3 } });
      result.current.dispatch({ type: 'ADD_VISIT', payload: { visitId: '2', parkId: 110, rating: 4 } });
    });
    act(() => result.current.dispatch({ type: 'UPDATE_VISIT', payload: { visitId: '1', rating: 5 } }));

    expect(result.current.state.visits.find(v => v.visitId === '2').rating).toBe(4);
  });

  it('DELETE_VISIT removes the matching visit', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => result.current.dispatch({ type: 'ADD_VISIT', payload: { visitId: '1', parkId: 109 } }));
    act(() => result.current.dispatch({ type: 'DELETE_VISIT', payload: '1' }));

    expect(result.current.state.visits).toHaveLength(0);
  });

  it('DELETE_VISIT does not remove visits with a different visitId', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({ type: 'ADD_VISIT', payload: { visitId: '1', parkId: 109 } });
      result.current.dispatch({ type: 'ADD_VISIT', payload: { visitId: '2', parkId: 110 } });
    });
    act(() => result.current.dispatch({ type: 'DELETE_VISIT', payload: '1' }));

    expect(result.current.state.visits).toHaveLength(1);
    expect(result.current.state.visits[0].visitId).toBe('2');
  });

  it('SAVE_TRIP appends a trip plan', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const trip = { tripId: 'abc', name: 'West Coast' };

    act(() => result.current.dispatch({ type: 'SAVE_TRIP', payload: trip }));

    expect(result.current.state.tripPlans).toContainEqual(trip);
  });

  it('DELETE_TRIP removes by tripId', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => result.current.dispatch({ type: 'SAVE_TRIP', payload: { tripId: 'abc', name: 'West Coast' } }));
    act(() => result.current.dispatch({ type: 'DELETE_TRIP', payload: 'abc' }));

    expect(result.current.state.tripPlans).toHaveLength(0);
  });
});

describe('AppContext localStorage seeding', () => {
  // Note: initialState is a module-level constant evaluated at import time, so
  // we test the mirror (write path) here rather than the initial seed (read path).
  // The read path is exercised indirectly by a fresh module load in the real browser.

  it('mirrors state changes back to localStorage', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const visit = { visitId: '1', parkId: 109 };

    act(() => result.current.dispatch({ type: 'ADD_VISIT', payload: visit }));

    const stored = JSON.parse(localStorage.getItem('ballpark_visits'));
    expect(stored).toContainEqual(visit);
  });
});

describe('useApp guard', () => {
  it('throws when used outside AppProvider', () => {
    // Suppress the expected error output in test logs
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useApp())).toThrow('useApp must be used within AppProvider');
    consoleSpy.mockRestore();
  });
});
