import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFormatGameTime = vi.fn();
vi.mock('../../../services/mlbApi', () => ({
  formatGameDate: (d) => d,
  formatGameTime: (t, tz) => mockFormatGameTime(t, tz),
}));

import AvailableGames from '../AvailableGames.jsx';

// Two real parks from parks.js so PARK_BY_ID resolves correctly:
//   109 = Arizona Diamondbacks (Chase Field, America/Phoenix)
//   110 = Baltimore Orioles    (Oriole Park at Camden Yards, America/New_York)
const GAMES_BY_PARK = {
  109: [{ gamePk: 1001, date: '2025-07-04', gameTime: '2025-07-04T18:00:00Z' }],
  110: [{ gamePk: 1002, date: '2025-07-05', gameTime: '2025-07-05T23:00:00Z' }],
};

function renderGames(props = {}) {
  return render(
    <AvailableGames
      gamesByPark={GAMES_BY_PARK}
      selectedParks={[]}
      onTogglePark={vi.fn()}
      onSelectAll={vi.fn()}
      startCityParkId={null}
      {...props}
    />,
  );
}

beforeEach(() => {
  mockFormatGameTime.mockImplementation((t, tz) => `${t}@${tz ?? 'local'}`);
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe('AvailableGames — empty state', () => {
  it('shows the empty message when gamesByPark is empty', () => {
    render(
      <AvailableGames
        gamesByPark={{}}
        selectedParks={[]}
        onTogglePark={vi.fn()}
      />,
    );
    expect(screen.getByText(/no home games found/i)).toBeTruthy();
  });
});

// ── Park list rendering ───────────────────────────────────────────────────────

describe('AvailableGames — park list', () => {
  it('shows the correct available parks count', () => {
    renderGames();
    expect(screen.getByText(/available parks \(2\)/i)).toBeTruthy();
  });

  it('renders venue names for each park', () => {
    renderGames();
    expect(screen.getByText('Chase Field')).toBeTruthy();
    expect(screen.getByText('Oriole Park at Camden Yards')).toBeTruthy();
  });

  it('shows the game count for each park', () => {
    renderGames();
    expect(screen.getAllByText('1 games')).toHaveLength(2);
  });

  it('calls onTogglePark with the parkId when a park is clicked', () => {
    const onTogglePark = vi.fn();
    renderGames({ onTogglePark });
    fireEvent.click(screen.getByText('Chase Field').closest('button'));
    expect(onTogglePark).toHaveBeenCalledWith(109);
  });

  it('shows the selected count', () => {
    renderGames({ selectedParks: [109] });
    expect(screen.getByText('1 selected')).toBeTruthy();
  });
});

// ── Select All / Deselect All ─────────────────────────────────────────────────

describe('AvailableGames — Select All', () => {
  it('shows "Select All" when no parks are selected', () => {
    renderGames({ selectedParks: [] });
    expect(screen.getByText('Select All')).toBeTruthy();
  });

  it('shows "Select All" when only some parks are selected', () => {
    renderGames({ selectedParks: [109] });
    expect(screen.getByText('Select All')).toBeTruthy();
  });

  it('shows "Deselect All" when all parks are selected', () => {
    renderGames({ selectedParks: [109, 110] });
    expect(screen.getByText('Deselect All')).toBeTruthy();
  });

  it('calls onSelectAll(true) when Select All is clicked', () => {
    const onSelectAll = vi.fn();
    renderGames({ onSelectAll });
    fireEvent.click(screen.getByText('Select All'));
    expect(onSelectAll).toHaveBeenCalledWith(true);
  });

  it('calls onSelectAll(false) when Deselect All is clicked', () => {
    const onSelectAll = vi.fn();
    renderGames({ selectedParks: [109, 110], onSelectAll });
    fireEvent.click(screen.getByText('Deselect All'));
    expect(onSelectAll).toHaveBeenCalledWith(false);
  });
});

// ── Start city sorting ────────────────────────────────────────────────────────

describe('AvailableGames — start city sorting', () => {
  it('renders parks alphabetically when startCityParkId is null (ARI before BAL)', () => {
    const { container } = renderGames({ startCityParkId: null });
    const venueNames = container.querySelectorAll('p.font-medium');
    expect(venueNames[0].textContent).toBe('Chase Field');              // Arizona
    expect(venueNames[1].textContent).toBe('Oriole Park at Camden Yards'); // Baltimore
  });

  it('sorts the start city park to the top', () => {
    const { container } = renderGames({ startCityParkId: 110 }); // Baltimore first
    const venueNames = container.querySelectorAll('p.font-medium');
    expect(venueNames[0].textContent).toBe('Oriole Park at Camden Yards');
    expect(venueNames[1].textContent).toBe('Chase Field');
  });
});

// ── Venue-local game times ────────────────────────────────────────────────────

describe('AvailableGames — venue-local times', () => {
  it('passes the park timezone to formatGameTime', () => {
    renderGames();
    expect(mockFormatGameTime).toHaveBeenCalledWith(
      '2025-07-04T18:00:00Z',
      'America/Phoenix', // ARI
    );
    expect(mockFormatGameTime).toHaveBeenCalledWith(
      '2025-07-05T23:00:00Z',
      'America/New_York', // BAL
    );
  });
});
