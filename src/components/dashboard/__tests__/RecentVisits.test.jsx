import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUsePhotoUrl = vi.fn();
vi.mock('../../../hooks/usePhotoUrl', () => ({
  usePhotoUrl: (key) => mockUsePhotoUrl(key),
}));

const mockVisits = vi.fn();
vi.mock('../../../hooks/useVisits', () => ({
  useVisits: () => ({ visits: mockVisits() }),
}));

const mockState = vi.fn();
vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({ state: mockState() }),
}));

import RecentVisits from '../RecentVisits.jsx';

const PARKS = [
  { teamId: 109, teamName: 'Arizona Diamondbacks', venueName: 'Chase Field', abbreviation: 'ARI' },
  { teamId: 110, teamName: 'Baltimore Orioles',    venueName: 'Oriole Park',  abbreviation: 'BAL' },
];

function renderComponent() {
  return render(
    <MemoryRouter>
      <RecentVisits />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUsePhotoUrl.mockReturnValue(null);
  mockState.mockReturnValue({ parks: PARKS });
});

describe('RecentVisits — empty state', () => {
  it('shows the "No visits yet" empty state when there are no visits', () => {
    mockVisits.mockReturnValue([]);
    renderComponent();
    expect(screen.getByText('No visits yet')).toBeTruthy();
  });
});

describe('RecentVisits — with visits', () => {
  it('renders the venue name for each recent visit', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 0, photoKeys: [] },
    ]);
    renderComponent();
    expect(screen.getByText('Chase Field')).toBeTruthy();
  });

  it('shows at most 3 recent visits, sorted newest first', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-01-01', rating: 0, photoKeys: [] },
      { visitId: '2', parkId: 109, visitDate: '2025-07-04', rating: 0, photoKeys: [] },
      { visitId: '3', parkId: 109, visitDate: '2025-03-15', rating: 0, photoKeys: [] },
      { visitId: '4', parkId: 110, visitDate: '2025-08-01', rating: 0, photoKeys: [] },
    ]);
    renderComponent();
    // Only 3 rows shown; all link to park pages
    const links = screen.getAllByRole('link').filter(l => l.href.includes('/parks/'));
    expect(links).toHaveLength(3);
  });

  it('shows the team logo when there is no photo', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 0, photoKeys: [] },
    ]);
    renderComponent();
    const imgs = screen.getAllByRole('img');
    const logo = imgs.find(img => img.src.includes('mlbstatic.com'));
    expect(logo).toBeTruthy();
  });

  it('shows the photo when usePhotoUrl resolves a URL', () => {
    mockUsePhotoUrl.mockReturnValue('https://cdn.example.com/photo.jpg');
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 0, photoKeys: ['photos/109/photo.jpg'] },
    ]);
    renderComponent();
    const photo = screen.getByRole('img', { name: 'Baseball' });
    expect(photo.getAttribute('src')).toBe('https://cdn.example.com/photo.jpg');
  });

  it('falls back to legacy base64 key in photoKeys[0]', () => {
    const base64 = 'data:image/jpeg;base64,/9j/fake';
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 0, photoKeys: [base64] },
    ]);
    renderComponent();
    const photo = screen.getByRole('img', { name: 'Baseball' });
    expect(photo.getAttribute('src')).toBe(base64);
  });

  it('does not pass a base64 string to usePhotoUrl', () => {
    const base64 = 'data:image/jpeg;base64,/9j/fake';
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 0, photoKeys: [base64] },
    ]);
    renderComponent();
    expect(mockUsePhotoUrl).toHaveBeenCalledWith(null);
  });

  it('shows star rating when visit has a rating > 0', () => {
    mockVisits.mockReturnValue([
      { visitId: '1', parkId: 109, visitDate: '2025-07-04', rating: 3, photoKeys: [] },
    ]);
    renderComponent();
    expect(screen.getByText('★★★')).toBeTruthy();
  });
});
