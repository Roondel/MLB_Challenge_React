import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import { useVisits } from '../../hooks/useVisits';
import { PARKS } from '../../data/parks';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

// Bounds that contain all 30 parks (with padding)
const ALL_PARKS_BOUNDS = L.latLngBounds(
  PARKS.map(p => [p.lat, p.lng])
);

// Fit map to all parks after container is properly sized
function FitBoundsOnMount() {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(ALL_PARKS_BOUNDS, { padding: [30, 30] });
      fitted.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

export default function BallparkMap() {
  const { state } = useApp();
  const { isVisited } = useVisits();
  // Force fresh MapContainer mount by keying on a one-time value
  const [mapKey] = useState(() => Date.now());

  return (
    <MapContainer
      key={mapKey}
      center={[39.8, -98.6]}
      zoom={4}
      className="w-full h-full"
      zoomControl={false}
      style={{ background: '#0a0a0a' }}
    >
      <FitBoundsOnMount />
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {state.parks.map(park => {
        const visited = isVisited(park.teamId);
        return (
          <CircleMarker
            key={park.teamId}
            center={[park.lat, park.lng]}
            radius={visited ? 8 : 6}
            pathOptions={{
              color: visited ? '#c8102e' : '#4a4a4a',
              fillColor: visited ? '#c8102e' : '#2a2a2a',
              fillOpacity: visited ? 0.9 : 0.6,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-center">
                <p className="font-bold text-sm">{park.venueName}</p>
                <p className="text-xs text-gray-400">{park.teamName}</p>
                <p className="text-xs text-gray-500">{park.city}, {park.state}</p>
                <Link
                  to={`/parks/${park.teamId}`}
                  className="text-accent text-xs hover:underline mt-1 inline-block"
                >
                  {visited ? 'View Journal' : 'View Details'} &rarr;
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
