import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockVisits = vi.fn();
vi.mock('../../../hooks/useVisits', () => ({
  useVisits: () => ({ visits: mockVisits() }),
}));

const mockState = vi.fn();
vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({ state: mockState() }),
}));

import StatsCards from '../StatsCards.jsx';

const PARKS = [
  { teamId: 109, teamName: 'Arizona Diamondbacks', venueName: 'Chase Field' },
  { teamId: 110, teamName: 'Baltimore Orioles',    venueName: 'Oriole Park at Camden Yards' },
];

beforeEach(() => {
  mockState.mockReturnValue({ parks: PARKS });
});

// ── No visits ─────────────────────────────────────────────────────────────────

describe('StatsCards — no visits', () => {
  beforeEach(() => { mockVisits.mockReturnValue([]); });

  it('does NOT render a Parks Visited card', () => {
    render(<StatsCards />);
    expect(screen.queryByText('Parks Visited')).toBeNull();
  });

  it('renders the Avg Rating card', () => {
    render(<StatsCards />);
    expect(screen.getByText('Avg Rating')).toBeTruthy();
  });

  it('renders the Last Visit card', () => {
    render(<StatsCards />);
    expect(screen.getByText('Last Visit')).toBeTruthy();
  });

  it('shows "no ratings yet" when there are no rated visits', () => {
    render(<StatsCards />);
    expect(screen.getByText('no ratings yet')).toBeTruthy();
  });

  it('shows "plan your first trip" when there are no visits', () => {
    render(<StatsCards />);
    expect(screen.getByText('plan your first trip')).toBeTruthy();
  });

  it('renders exactly 2 stat cards (Avg Rating + Last Visit)', () => {
    const { container } = render(<StatsCards />);
    // Each card is a div with border-dark-600
    const cards = container.querySelectorAll('.border.border-dark-600');
    expect(cards).toHaveLength(2);
  });
});

// ── With visits ───────────────────────────────────────────────────────────────

describe('StatsCards — with visits', () => {
  it('computes the average rating across rated visits', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 4 },
      { visitId: '2', parkId: 110, visitDate: '2025-07-05', rating: 2 },
    ]);
    render(<StatsCards />);
    expect(screen.getByText('3.0')).toBeTruthy();
    expect(screen.getByText('from 2 rated')).toBeTruthy();
  });

  it('ignores visits with rating 0 in the average calculation', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 5 },
      { visitId: '2', parkId: 110, visitDate: '2025-07-05', rating: 0 }, // unrated
    ]);
    render(<StatsCards />);
    expect(screen.getByText('5.0')).toBeTruthy();
    expect(screen.getByText('from 1 rated')).toBeTruthy();
  });

  it('shows "—" for avg rating when no visits have a rating', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 0 },
    ]);
    render(<StatsCards />);
    expect(screen.getByText('no ratings yet')).toBeTruthy();
  });

  it('shows the venue name as the Last Visit subtext', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 4 },
    ]);
    render(<StatsCards />);
    expect(screen.getByText('Chase Field')).toBeTruthy();
  });

  it('shows the most recent visit when multiple visits exist', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-01-01', rating: 3 },
      { visitId: '2', parkId: 110, visitDate: '2025-07-10', rating: 4 }, // most recent
    ]);
    render(<StatsCards />);
    // Most recent visit was at Oriole Park
    expect(screen.getByText('Oriole Park at Camden Yards')).toBeTruthy();
  });
});
