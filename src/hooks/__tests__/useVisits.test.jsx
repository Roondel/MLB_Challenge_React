import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

const mockApiSaveVisit   = vi.fn().mockResolvedValue({});
const mockApiDeleteVisit = vi.fn().mockResolvedValue({});

vi.mock('../../services/api', () => ({
  API_AVAILABLE:  true,
  AUTH_EXPIRED:   Symbol('AUTH_EXPIRED'),
  saveVisit:      (...args) => mockApiSaveVisit(...args),
  deleteVisit:    (...args) => mockApiDeleteVisit(...args),
  // Never-resolving promises: AppProvider's initial load effects won't dispatch
  // SET_VISITS/SET_TRIPS and accidentally wipe state added during tests.
  fetchAllVisits: vi.fn().mockReturnValue(new Promise(() => {})),
  fetchAllTrips:  vi.fn().mockReturnValue(new Promise(() => {})),
}));

import { AppProvider } from '../../context/AppContext.jsx';
import { useVisits } from '../useVisits.js';

const wrapper = ({ children }) => <AppProvider>{children}</AppProvider>;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ── addVisit ──────────────────────────────────────────────────────────────────

describe('addVisit', () => {
  it('adds the visit to state synchronously (optimistic update)', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04' });
    });

    expect(result.current.visits).toHaveLength(1);
    expect(result.current.visits[0].parkId).toBe(109);
  });

  it('auto-assigns visitId and createdAt', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04' });
    });

    const visit = result.current.visits[0];
    expect(visit.visitId).toBeTruthy();
    expect(visit.createdAt).toBeTruthy();
  });

  it('calls apiSaveVisit with the new visit when API is available', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04' });
    });

    expect(mockApiSaveVisit).toHaveBeenCalledOnce();
    const saved = mockApiSaveVisit.mock.calls[0][0];
    expect(saved.parkId).toBe(109);
    expect(saved.visitId).toBeTruthy();
  });

  it('does not throw or rollback state when apiSaveVisit fails', async () => {
    mockApiSaveVisit.mockRejectedValueOnce(new Error('API down'));
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04' });
    });

    // State still updated despite API failure (optimistic — localStorage backs it up)
    expect(result.current.visits).toHaveLength(1);
  });
});

// ── updateVisit ───────────────────────────────────────────────────────────────

describe('updateVisit', () => {
  it('updates the correct visit in state', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    let visitId;
    await act(async () => {
      const v = await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04', rating: 3 });
      visitId = v.visitId;
    });

    await act(async () => {
      await result.current.updateVisit(visitId, { rating: 5 });
    });

    expect(result.current.visits[0].rating).toBe(5);
  });

  it('calls apiSaveVisit with merged data', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    let visitId;
    await act(async () => {
      const v = await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04', rating: 3 });
      visitId = v.visitId;
    });
    vi.clearAllMocks();

    await act(async () => {
      await result.current.updateVisit(visitId, { rating: 5, personalNote: 'Updated' });
    });

    expect(mockApiSaveVisit).toHaveBeenCalledOnce();
    const saved = mockApiSaveVisit.mock.calls[0][0];
    expect(saved.rating).toBe(5);
    expect(saved.personalNote).toBe('Updated');
    expect(saved.parkId).toBe(109); // original field preserved
  });
});

// ── deleteVisit ───────────────────────────────────────────────────────────────

describe('deleteVisit', () => {
  it('removes the visit from state', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    let visitId;
    await act(async () => {
      const v = await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04' });
      visitId = v.visitId;
    });

    await act(async () => {
      await result.current.deleteVisit(visitId);
    });

    expect(result.current.visits).toHaveLength(0);
  });

  it('calls apiDeleteVisit with parkId (not visitId)', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    let visitId;
    await act(async () => {
      const v = await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04' });
      visitId = v.visitId;
    });
    vi.clearAllMocks();

    await act(async () => {
      await result.current.deleteVisit(visitId);
    });

    // Backend DELETE takes parkId, not visitId
    expect(mockApiDeleteVisit).toHaveBeenCalledWith(109);
  });

  it('does not call apiDeleteVisit when the visit is not found', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.deleteVisit('nonexistent-id');
    });

    expect(mockApiDeleteVisit).not.toHaveBeenCalled();
  });
});

// ── Derived values ────────────────────────────────────────────────────────────

describe('derived values', () => {
  it('visitedCount reflects the number of visits', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04' });
      await result.current.addVisit({ parkId: 110, visitDate: '2025-07-05' });
    });

    expect(result.current.visitedCount).toBe(2);
  });

  it('isVisited returns true for visited parks, false otherwise', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109 });
    });

    expect(result.current.isVisited(109)).toBe(true);
    expect(result.current.isVisited(110)).toBe(false);
  });

  it('getVisitByParkId returns the correct visit', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109, visitDate: '2025-07-04', rating: 4 });
    });

    const found = result.current.getVisitByParkId(109);
    expect(found).toBeTruthy();
    expect(found.parkId).toBe(109);
  });

  it('averageRating computes correctly across visits with ratings', async () => {
    const { result } = renderHook(() => useVisits(), { wrapper });

    await act(async () => {
      await result.current.addVisit({ parkId: 109, rating: 4 });
      await result.current.addVisit({ parkId: 110, rating: 2 });
    });

    expect(parseFloat(result.current.averageRating)).toBeCloseTo(3.0);
  });

  it('averageRating is 0 when there are no visits', () => {
    const { result } = renderHook(() => useVisits(), { wrapper });
    expect(result.current.averageRating).toBe(0);
  });
});
