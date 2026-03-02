import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFormatGameTime = vi.fn();
vi.mock('../../../services/mlbApi', () => ({
  formatGameDate: (d) => d,
  formatGameTime: (t, tz) => mockFormatGameTime(t, tz),
}));

import RoutePreview from '../RoutePreview.jsx';

// Two real parks from parks.js:
//   109 = Arizona Diamondbacks  (America/Phoenix)
//   110 = Baltimore Orioles     (America/New_York)
const MINIMAL_ROUTE = {
  totalMiles: 2500,
  warnings: [],
  unreachableParks: [],
  itinerary: [
    {
      parkId: 109,
      parkName: 'Chase Field',
      teamName: 'Arizona Diamondbacks',
      driveFromPrev: null,
      game: {
        gamePk: 1001,
        date: '2025-07-04',
        gameTime: '2025-07-04T18:00:00Z',
        dayNight: 'D',
        awayTeamName: 'Los Angeles Dodgers',
      },
    },
    {
      parkId: 110,
      parkName: 'Oriole Park at Camden Yards',
      teamName: 'Baltimore Orioles',
      driveFromPrev: { miles: 2500, driveTime: '38h', overnightStops: 2 },
      game: {
        gamePk: 1002,
        date: '2025-07-08',
        gameTime: '2025-07-08T23:00:00Z',
        dayNight: 'N',
        awayTeamName: 'New York Yankees',
      },
    },
  ],
};

beforeEach(() => {
  mockFormatGameTime.mockImplementation((t, tz) => `${t}@${tz ?? 'local'}`);
});

// ── Null / empty state ────────────────────────────────────────────────────────

describe('RoutePreview — null/empty state', () => {
  it('renders nothing when routeResult is null', () => {
    const { container } = render(<RoutePreview routeResult={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when itinerary is empty and no unreachable parks', () => {
    const { container } = render(
      <RoutePreview
        routeResult={{ itinerary: [], totalMiles: 0, warnings: [], unreachableParks: [] }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an error panel when itinerary is empty but there are unreachable parks', () => {
    render(
      <RoutePreview
        routeResult={{
          itinerary: [],
          totalMiles: 0,
          warnings: [],
          unreachableParks: [{ parkId: 115, teamName: 'Colorado Rockies', reason: 'No games in range' }],
        }}
      />,
    );
    expect(screen.getByText(/could not schedule/i)).toBeTruthy();
    expect(screen.getByText(/Colorado Rockies/)).toBeTruthy();
  });
});

// ── Itinerary rendering ───────────────────────────────────────────────────────

describe('RoutePreview — itinerary', () => {
  it('renders the Suggested Route heading', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText(/suggested route/i)).toBeTruthy();
  });

  it('renders a stop for each park in the itinerary', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText('Chase Field')).toBeTruthy();
    expect(screen.getByText('Oriole Park at Camden Yards')).toBeTruthy();
  });

  it('renders the matchup for each stop', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText(/Arizona Diamondbacks vs Los Angeles Dodgers/i)).toBeTruthy();
    expect(screen.getByText(/Baltimore Orioles vs New York Yankees/i)).toBeTruthy();
  });

  it('shows ☀ Day for day games', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText('☀ Day')).toBeTruthy();
  });

  it('shows 🌙 Night for night games', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText('🌙 Night')).toBeTruthy();
  });

  it('shows total mileage in the header', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText(/2,500 miles|2500 miles/)).toBeTruthy();
  });

  it('shows drive distance for non-first stops', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText(/2500 mi/)).toBeTruthy();
  });

  it('shows overnight stop count for long drives', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(screen.getByText(/2 overnight stops/)).toBeTruthy();
  });

  it('does not show drive info for the first stop', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    // First stop has driveFromPrev: null — only 1 drive line should appear
    const driveLines = screen.queryAllByText(/mi · ~/);
    expect(driveLines).toHaveLength(1);
  });
});

// ── Venue-local times ─────────────────────────────────────────────────────────

describe('RoutePreview — venue-local times', () => {
  it('passes each park\'s timezone to formatGameTime', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    // ARI (109) → America/Phoenix
    expect(mockFormatGameTime).toHaveBeenCalledWith(
      '2025-07-04T18:00:00Z',
      'America/Phoenix',
    );
    // BAL (110) → America/New_York
    expect(mockFormatGameTime).toHaveBeenCalledWith(
      '2025-07-08T23:00:00Z',
      'America/New_York',
    );
  });

  it('shows the venue local time zone footer note', () => {
    render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(
      screen.getByText(/game times shown in each venue's local time zone/i),
    ).toBeTruthy();
  });
});

// ── Warnings ─────────────────────────────────────────────────────────────────

describe('RoutePreview — warnings', () => {
  it('renders warnings when present', () => {
    render(
      <RoutePreview
        routeResult={{
          ...MINIMAL_ROUTE,
          warnings: ['Stop 2 drive may span multiple days'],
        }}
      />,
    );
    expect(screen.getByText(/stop 2 drive may span multiple days/i)).toBeTruthy();
  });

  it('renders no warning section when warnings is empty', () => {
    const { container } = render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    // No yellow warning block
    expect(container.querySelector('.bg-yellow-900\\/20')).toBeNull();
  });
});

// ── Unreachable parks ─────────────────────────────────────────────────────────

describe('RoutePreview — unreachable parks', () => {
  it('shows the "Could not schedule" section for unreachable parks', () => {
    render(
      <RoutePreview
        routeResult={{
          ...MINIMAL_ROUTE,
          unreachableParks: [{ parkId: 115, teamName: 'Colorado Rockies', reason: 'No games in range' }],
        }}
      />,
    );
    expect(screen.getByText(/could not schedule/i)).toBeTruthy();
    expect(screen.getByText(/Colorado Rockies — No games in range/)).toBeTruthy();
  });

  it('does not render the unreachable section when list is empty', () => {
    const { container } = render(<RoutePreview routeResult={MINIMAL_ROUTE} />);
    expect(container.querySelector('.bg-red-900\\/20')).toBeNull();
  });
});
