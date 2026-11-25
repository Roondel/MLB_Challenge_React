import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// A fake Leaflet map, shared by every useMap() call in the component.
const fakeMap = {
  invalidateSize: vi.fn(),
  fitBounds: vi.fn(),
  removeLayer: vi.fn(),
};

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  CircleMarker: ({ children }) => <div data-testid="park-marker">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  TileLayer: () => <div data-testid="raster-tile-layer" />,
  useMap: () => fakeMap,
}));

// The self-hosted basemap layer. addTo() is what puts it on the map.
const fakeBasemapLayer = { addTo: vi.fn() };
const mockLeafletLayer = vi.fn(() => fakeBasemapLayer);
vi.mock('protomaps-leaflet', () => ({
  leafletLayer: (options) => mockLeafletLayer(options),
}));

const PARKS = [
  { teamId: 109, venueName: 'Chase Field', teamName: 'Arizona Diamondbacks', city: 'Phoenix', state: 'AZ', lat: 33.445, lng: -112.067 },
  { teamId: 110, venueName: 'Oriole Park', teamName: 'Baltimore Orioles', city: 'Baltimore', state: 'MD', lat: 39.284, lng: -76.622 },
];

vi.mock('../../../data/parks', () => ({
  PARKS: [
    { teamId: 109, lat: 33.445, lng: -112.067 },
    { teamId: 110, lat: 39.284, lng: -76.622 },
  ],
}));

vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({ state: { parks: PARKS } }),
}));

vi.mock('../../../hooks/useVisits', () => ({
  useVisits: () => ({ isVisited: (teamId) => teamId === 109 }),
}));

import BallparkMap from '../BallparkMap.jsx';

function renderMap() {
  return render(
    <MemoryRouter>
      <BallparkMap />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BallparkMap basemap', () => {
  it('loads the self-hosted dark Protomaps basemap', () => {
    renderMap();

    expect(mockLeafletLayer).toHaveBeenCalledTimes(1);
    const options = mockLeafletLayer.mock.calls[0][0];
    expect(options.url).toBe('/tiles/basemap.pmtiles');
    expect(options.flavor).toBe('dark');
    expect(options.lang).toBe('en');
  });

  it('credits Protomaps and OpenStreetMap', () => {
    renderMap();

    const options = mockLeafletLayer.mock.calls[0][0];
    expect(options.attribution).toContain('Protomaps');
    expect(options.attribution).toContain('OpenStreetMap');
  });

  it('adds the basemap to the map', () => {
    renderMap();

    expect(fakeBasemapLayer.addTo).toHaveBeenCalledWith(fakeMap);
  });

  it('removes the basemap when the map unmounts', () => {
    const { unmount } = renderMap();
    unmount();

    expect(fakeMap.removeLayer).toHaveBeenCalledWith(fakeBasemapLayer);
  });

  it('no longer uses third-party raster tiles', () => {
    const { queryByTestId } = renderMap();

    expect(queryByTestId('raster-tile-layer')).toBeNull();
  });

  it('still draws a marker for every park', () => {
    const { getAllByTestId } = renderMap();

    expect(getAllByTestId('park-marker')).toHaveLength(PARKS.length);
  });
});
