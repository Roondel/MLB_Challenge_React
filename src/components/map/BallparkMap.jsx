import { useEffect, useRef, useState } from 'react';
import { MapContainer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import { useApp } from '../../context/AppContext';
import { useVisits } from '../../hooks/useVisits';
import { PARKS } from '../../data/parks';

// Self-hosted basemap: a single Protomaps file in the hosting bucket, served by
// our own CloudFront. No third-party tile provider, no API key.
// The file is uploaded once per environment and deploy-app.sh never touches it
// (see the tiles/ exclude there). For local dev, copy it into public/tiles/.
const BASEMAP_URL = '/tiles/basemap.pmtiles';
const BASEMAP_ATTRIBUTION = '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Highest zoom level baked into the basemap file. Leaflet can still zoom in
// further; the map just scales up the most detailed data it has.
const BASEMAP_MAX_DATA_ZOOM = 10;

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

// Adds the dark Protomaps basemap to the map, and removes it again on unmount.
function ProtomapsBasemap() {
  const map = useMap();

  useEffect(() => {
    const basemapLayer = leafletLayer({
      url: BASEMAP_URL,
      flavor: 'dark',
      lang: 'en',
      attribution: BASEMAP_ATTRIBUTION,
      maxDataZoom: BASEMAP_MAX_DATA_ZOOM,
    });
    basemapLayer.addTo(map);

    return () => {
      map.removeLayer(basemapLayer);
    };
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
      <ProtomapsBasemap />
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
