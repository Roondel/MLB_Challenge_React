import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Pencil, Trash2, CheckCircle2, Navigation, Cloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useVisits } from '../hooks/useVisits';
import { useToast } from '../components/layout/Toast';
import { useGeoProximity } from '../hooks/useGeoProximity';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import CheckInModal from '../components/parks/CheckInModal';
import StarRating from '../components/parks/StarRating';
import { showParkNotification, registerServiceWorker } from '../services/notifications';

export default function ParkDetailPage() {
  const { parkId } = useParams();
  const { state } = useApp();
  const { getVisitByParkId, isVisited, deleteVisit } = useVisits();
  const { addToast } = useToast();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const park = state.parks.find(p => p.teamId === Number(parkId));
  const visit = getVisitByParkId(Number(parkId));
  const visited = isVisited(Number(parkId));
  const { nearby } = useGeoProximity(park?.lat, park?.lng);

  // Resolve photo for display — handles S3 keys, legacy base64, and old field name
  const visitPhotoKey = visit?.photoKeys?.[0];
  const isBase64Key = visitPhotoKey?.startsWith('data:image/');
  const resolvedPhotoUrl = usePhotoUrl(!isBase64Key ? visitPhotoKey : null);
  const photoSrc = resolvedPhotoUrl
    ?? (isBase64Key ? visitPhotoKey : null)
    ?? visit?.baseballPhotoBase64
    ?? null;

  if (!park) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        <p className="text-gray-500">Park not found</p>
        <Link to="/map" className="text-accent hover:underline text-sm">Back to map</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Back nav */}
      <Link to="/map" className="inline-flex items-center gap-1 text-gray-500 hover:text-white text-sm transition-colors">
        <ArrowLeft size={16} />
        Back to Map
      </Link>

      {/* Park Header */}
      <div className="bg-dark-800 rounded-2xl border border-dark-600 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-dark-700 flex items-center justify-center flex-shrink-0">
              <img
                src={`https://www.mlbstatic.com/team-logos/${park.teamId}.svg`}
                alt={park.abbreviation}
                className="w-12 h-12"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{park.venueName}</h1>
                {visited && (
                  <span className="flex items-center gap-1 px-3 py-1 bg-accent/20 text-accent text-sm rounded-full">
                    <CheckCircle2 size={14} />
                    Visited
                  </span>
                )}
              </div>
              <p className="text-gray-400 mt-1">{park.teamName}</p>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <MapPin size={14} />
                <span>{park.city}, {park.state}</span>
                <span className="mx-2">&middot;</span>
                <span>{park.division}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GPS proximity banner */}
      {nearby && (
        <div className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <Navigation size={18} className="text-accent flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-accent">
                {visited ? `You're back at ${park.venueName}!` : `You're at ${park.venueName}!`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">GPS detected you're nearby</p>
            </div>
          </div>
          {!visited && (
            <button
              onClick={() => setShowCheckIn(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
            >
              Check In Now
            </button>
          )}
        </div>
      )}

      {/* Visit Journal */}
      {visited && visit ? (
        <div className="bg-dark-800 rounded-2xl border border-dark-600 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Your Visit</h2>
            <div className="flex gap-2">
              <button
                data-testid="edit-visit"
                onClick={() => setShowCheckIn(true)}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <Pencil size={16} />
              </button>
              <button
                data-testid="delete-visit"
                onClick={() => setConfirmDelete(true)}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-gray-400">
              <Calendar size={14} />
              {new Date(visit.visitDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            {visit.rating > 0 && (
              <StarRating value={visit.rating} readonly size={16} />
            )}
          </div>

          {photoSrc && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Baseball Collection</p>
              <img
                src={photoSrc}
                alt="Baseball from visit"
                className="w-full max-w-md rounded-xl"
              />
            </div>
          )}

          {visit.personalNote && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-gray-300 text-sm leading-relaxed">{visit.personalNote}</p>
            </div>
          )}

          {visit.weather && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Weather</p>
              <div className="flex items-center gap-1 text-sm text-gray-300">
                <Cloud size={14} className="text-gray-500" />
                {visit.weather}
              </div>
            </div>
          )}

          {visit.gameAttended && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Game</p>
              <div className="flex gap-4 text-sm">
                {visit.opponent && <span className="text-gray-300">vs {visit.opponent}</span>}
                {visit.gameScore && <span className="text-gray-400">{visit.gameScore}</span>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-dark-800 rounded-2xl border border-dark-600 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={24} className="text-gray-600" />
          </div>
          <h2 className="text-lg font-bold mb-1">Not Yet Visited</h2>
          <p className="text-gray-500 text-sm mb-4">Check in when you visit {park.venueName}</p>
          <button
            data-testid="checkin-button"
            onClick={() => setShowCheckIn(true)}
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
          >
            Check In
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 max-w-sm w-full">
            <h3 className="font-bold mb-2">Remove Visit?</h3>
            <p className="text-sm text-gray-400 mb-4">This will delete your check-in, photo, and notes for {park.venueName}.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 bg-dark-700 rounded-lg text-sm hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-delete"
                onClick={() => {
                  deleteVisit(visit.visitId);
                  setConfirmDelete(false);
                  addToast(`Removed visit to ${park.venueName}`, 'info');
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Modal */}
      {showCheckIn && (
        <CheckInModal park={park} visit={visit} onClose={() => setShowCheckIn(false)} />
      )}
    </div>
  );
}
