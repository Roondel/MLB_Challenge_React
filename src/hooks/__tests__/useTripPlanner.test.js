import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
let mockTripPlans = [];

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ state: { tripPlans: mockTripPlans }, dispatch: mockDispatch }),
}));

const mockAddToast = vi.fn();
vi.mock('../../components/layout/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

const mockFetchHomeGamesByPark = vi.fn();
vi.mock('../../services/mlbApi', () => ({
  fetchHomeGamesByPark: (...a) => mockFetchHomeGamesByPark(...a),
}));

const mockSuggestScheduleRoute = vi.fn();
vi.mock('../../services/tripPlanner', () => ({
  suggestScheduleRoute: (...a) => mockSuggestScheduleRoute(...a),
}));

const mockApiSaveTrip   = vi.fn();
const mockApiDeleteTrip = vi.fn();
vi.mock('../../services/api', () => ({
  saveTrip:   (...a) => mockApiSaveTrip(...a),
  deleteTrip: (...a) => mockApiDeleteTrip(...a),
}));

import { useTripPlanner } from '../useTripPlanner';

// ── Setup ─────────────────────────────────────────────────────────────────────

const FAKE_ROUTE = { itinerary: [], totalMiles: 100, unreachableParks: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockTripPlans = [];
  mockSuggestScheduleRoute.mockReturnValue(FAKE_ROUTE);
  mockApiSaveTrip.mockResolvedValue({});
  mockApiDeleteTrip.mockResolvedValue({});
});

// ── handleSearch ──────────────────────────────────────────────────────────────

describe('handleSearch', () => {
  it('clears selectedParks, routeResult, and error before fetching', async () => {
    mockFetchHomeGamesByPark.mockResolvedValue({ 109: [] });
    const { result } = renderHook(() => useTripPlanner());

    // Prime some state
    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' });
    });

    // Second search should clear prior results
    mockFetchHomeGamesByPark.mockResolvedValue({ 110: [] });
    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-08-01', endDate: '2025-08-10', startCity: '' });
    });

    expect(result.current.selectedParks).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('sets gamesByPark with numeric keys on success', async () => {
    mockFetchHomeGamesByPark.mockResolvedValue({ '109': [{ gameId: 1 }], '119': [] });
    const { result } = renderHook(() => useTripPlanner());

    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' });
    });

    expect(result.current.gamesByPark).toHaveProperty(109);
    expect(result.current.gamesByPark).toHaveProperty(119);
  });

  it('sets error message when fetch fails', async () => {
    mockFetchHomeGamesByPark.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useTripPlanner());

    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' });
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });

  it('does not reset stopNotes or loadedTripId when preserveTrip is true', async () => {
    mockFetchHomeGamesByPark.mockResolvedValue({ 109: [] });
    const { result } = renderHook(() => useTripPlanner());

    // Simulate a loaded trip with notes
    await act(async () => {
      result.current.handleLoadTrip({
        tripId: 'trip-1',
        name: 'Test',
        startDate: '2025-07-01',
        endDate: '2025-07-10',
        startCity: '',
        selectedParks: [],
        routeResult: null,
        stopNotes: { 109: 'Great view' },
      });
    });

    await act(async () => {
      await result.current.handleSearch(
        { startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' },
        { preserveTrip: true },
      );
    });

    expect(result.current.stopNotes).toEqual({ 109: 'Great view' });
    expect(result.current.loadedTripId).toBe('trip-1');
  });
});

// ── handleReplan ──────────────────────────────────────────────────────────────

describe('handleReplan', () => {
  it('does nothing when searchParams is null', async () => {
    const { result } = renderHook(() => useTripPlanner());

    act(() => { result.current.handleReplan(); });

    expect(mockFetchHomeGamesByPark).not.toHaveBeenCalled();
  });

  it('re-runs handleSearch with current params and preserveTrip=true', async () => {
    mockFetchHomeGamesByPark.mockResolvedValue({ 109: [] });
    const { result } = renderHook(() => useTripPlanner());

    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' });
    });
    const firstCallCount = mockFetchHomeGamesByPark.mock.calls.length;

    await act(async () => {
      await result.current.handleReplan();
    });

    expect(mockFetchHomeGamesByPark.mock.calls.length).toBe(firstCallCount + 1);
  });
});

// ── handleTogglePark ──────────────────────────────────────────────────────────

describe('handleTogglePark', () => {
  async function searchFirst(result) {
    mockFetchHomeGamesByPark.mockResolvedValue({ 109: [], 119: [] });
    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' });
    });
  }

  it('adds a park to selectedParks when not selected', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchFirst(result);

    act(() => { result.current.handleTogglePark(109); });

    expect(result.current.selectedParks).toContain(109);
  });

  it('removes a park from selectedParks when already selected', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchFirst(result);

    act(() => { result.current.handleTogglePark(109); });
    act(() => { result.current.handleTogglePark(109); });

    expect(result.current.selectedParks).not.toContain(109);
  });

  it('calls suggestScheduleRoute after toggling', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchFirst(result);

    act(() => { result.current.handleTogglePark(109); });

    expect(mockSuggestScheduleRoute).toHaveBeenCalled();
  });
});

// ── handleSelectAll ───────────────────────────────────────────────────────────

describe('handleSelectAll', () => {
  async function searchFirst(result) {
    mockFetchHomeGamesByPark.mockResolvedValue({ 109: [], 119: [], 137: [] });
    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' });
    });
  }

  it('selects all available parks when called with true', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchFirst(result);

    act(() => { result.current.handleSelectAll(true); });

    expect(result.current.selectedParks).toHaveLength(3);
    expect(result.current.selectedParks).toContain(109);
    expect(result.current.selectedParks).toContain(119);
    expect(result.current.selectedParks).toContain(137);
  });

  it('clears selectedParks when called with false', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchFirst(result);

    act(() => { result.current.handleSelectAll(true); });
    act(() => { result.current.handleSelectAll(false); });

    expect(result.current.selectedParks).toHaveLength(0);
  });
});

// ── handleNoteChange ──────────────────────────────────────────────────────────

describe('handleNoteChange', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('updates stopNotes immediately (synchronous)', () => {
    const { result } = renderHook(() => useTripPlanner());

    act(() => { result.current.handleNoteChange(109, 'Great view'); });

    expect(result.current.stopNotes[109]).toBe('Great view');
  });

  it('does not call API before 800ms debounce window', () => {
    const { result } = renderHook(() => useTripPlanner());

    act(() => { result.current.handleNoteChange(109, 'Great view'); });
    act(() => { vi.advanceTimersByTime(799); });

    expect(mockApiSaveTrip).not.toHaveBeenCalled();
  });

  it('does not call API when loadedTripId is null (unsaved trip)', async () => {
    const { result } = renderHook(() => useTripPlanner());

    act(() => { result.current.handleNoteChange(109, 'Great view'); });
    await act(async () => { vi.advanceTimersByTime(800); });

    expect(mockApiSaveTrip).not.toHaveBeenCalled();
  });

  it('dispatches UPDATE_TRIP and calls API after 800ms when trip is loaded', async () => {
    mockTripPlans = [{ tripId: 'trip-1', name: 'Test', stopNotes: {} }];
    const { result } = renderHook(() => useTripPlanner());

    act(() => {
      result.current.handleLoadTrip({
        tripId: 'trip-1', name: 'Test', startDate: '2025-07-01',
        endDate: '2025-07-10', startCity: '', selectedParks: [], routeResult: null, stopNotes: {},
      });
    });

    act(() => { result.current.handleNoteChange(109, 'Great view'); });

    await act(async () => { vi.advanceTimersByTime(800); });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_TRIP' }));
    expect(mockApiSaveTrip).toHaveBeenCalled();
  });
});

// ── handleSaveTrip ────────────────────────────────────────────────────────────

describe('handleSaveTrip', () => {
  async function searchAndSetRoute(result) {
    mockFetchHomeGamesByPark.mockResolvedValue({ 109: [] });
    await act(async () => {
      await result.current.handleSearch({ startDate: '2025-07-01', endDate: '2025-07-10', startCity: '' });
    });
    act(() => { result.current.handleTogglePark(109); });
    act(() => { result.current.setTripName('West Coast Run'); });
  }

  it('dispatches SAVE_TRIP with correct payload shape', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchAndSetRoute(result);

    await act(async () => { await result.current.handleSaveTrip(); });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_TRIP',
      payload: expect.objectContaining({
        name: 'West Coast Run',
        startDate: '2025-07-01',
        endDate: '2025-07-10',
        selectedParks: expect.any(Array),
      }),
    }));
  });

  it('calls apiSaveTrip with the trip payload', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchAndSetRoute(result);

    await act(async () => { await result.current.handleSaveTrip(); });

    expect(mockApiSaveTrip).toHaveBeenCalledOnce();
  });

  it('resets tripName and hides save input after saving', async () => {
    const { result } = renderHook(() => useTripPlanner());
    await searchAndSetRoute(result);
    act(() => { result.current.setShowSaveInput(true); });

    await act(async () => { await result.current.handleSaveTrip(); });

    expect(result.current.tripName).toBe('');
    expect(result.current.showSaveInput).toBe(false);
  });
});

// ── handleLoadTrip ────────────────────────────────────────────────────────────

describe('handleLoadTrip', () => {
  const savedTrip = {
    tripId:       'trip-abc',
    name:         'East Coast',
    startDate:    '2025-06-01',
    endDate:      '2025-06-10',
    startCity:    'Boston, MA',
    selectedParks: [111, 120],
    routeResult:  FAKE_ROUTE,
    stopNotes:    { 111: 'Great hotdogs' },
  };

  it('restores searchParams, selectedParks, routeResult, stopNotes, and loadedTripId', () => {
    const { result } = renderHook(() => useTripPlanner());

    act(() => { result.current.handleLoadTrip(savedTrip); });

    expect(result.current.searchParams).toEqual({ startDate: '2025-06-01', endDate: '2025-06-10', startCity: 'Boston, MA' });
    expect(result.current.selectedParks).toEqual([111, 120]);
    expect(result.current.routeResult).toEqual(FAKE_ROUTE);
    expect(result.current.stopNotes).toEqual({ 111: 'Great hotdogs' });
    expect(result.current.loadedTripId).toBe('trip-abc');
  });

  it('sets gamesByPark to null so the loaded-trip RoutePreview is shown', () => {
    const { result } = renderHook(() => useTripPlanner());

    act(() => { result.current.handleLoadTrip(savedTrip); });

    expect(result.current.gamesByPark).toBeNull();
  });
});

// ── handleDeleteTrip ──────────────────────────────────────────────────────────

describe('handleDeleteTrip', () => {
  it('dispatches DELETE_TRIP with the correct tripId', async () => {
    const { result } = renderHook(() => useTripPlanner());

    await act(async () => { await result.current.handleDeleteTrip('trip-xyz'); });

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'DELETE_TRIP', payload: 'trip-xyz' });
  });

  it('calls apiDeleteTrip with the tripId', async () => {
    const { result } = renderHook(() => useTripPlanner());

    await act(async () => { await result.current.handleDeleteTrip('trip-xyz'); });

    expect(mockApiDeleteTrip).toHaveBeenCalledWith('trip-xyz');
  });
});

// ── hook return shape ─────────────────────────────────────────────────────────

describe('return shape', () => {
  it('exposes tripPlans from app state', () => {
    mockTripPlans = [{ tripId: 'a', name: 'Test' }];
    const { result } = renderHook(() => useTripPlanner());
    expect(result.current.tripPlans).toEqual([{ tripId: 'a', name: 'Test' }]);
  });

  it('exposes setEndParkId, setTripName, setShowSaveInput as setters', () => {
    const { result } = renderHook(() => useTripPlanner());
    expect(typeof result.current.setEndParkId).toBe('function');
    expect(typeof result.current.setTripName).toBe('function');
    expect(typeof result.current.setShowSaveInput).toBe('function');
  });
});
