import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Zap } from 'lucide-react';
import StarRating from './StarRating';
import PhotoUploader from './PhotoUploader';
import { useVisits } from '../../hooks/useVisits';
import { useToast } from '../layout/Toast';
import { fetchGameForParkOnDate, fetchWeatherForPark } from '../../services/mlbApi';
import { PARKS } from '../../data/parks';
import {
  API_AVAILABLE,
  requestUploadUrl,
  putToS3,
} from '../../services/api';
import { compressImage } from '../../services/imageUtils';

export default function CheckInModal({ park, visit, onClose }) {
  const { addVisit, updateVisit } = useVisits();
  const { addToast } = useToast();
  const isEditing = !!visit;
  const hasMounted = useRef(false);

  const [form, setForm] = useState({
    visitDate:    visit?.visitDate ?? new Date().toISOString().split('T')[0],
    photoKeys:    visit?.photoKeys ?? [],
    personalNote: visit?.personalNote ?? '',
    rating:       visit?.rating ?? 0,
    gameAttended: visit?.gameAttended ?? false,
    opponent:     visit?.opponent ?? '',
    gameScore:    visit?.gameScore ?? '',
    weather:      visit?.weather ?? '',
  });
  // Blob from PhotoUploader — uploaded to S3 on submit, not stored in form state
  const [pendingBlob, setPendingBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    // When editing, skip auto-fetch on mount — only fetch if user changes the date
    if (!hasMounted.current) {
      hasMounted.current = true;
      if (isEditing) return;
    }

    let cancelled = false;

    async function fetchData() {
      setGameLoading(true);
      setAutoFilled(false);

      try {
        const [game, weather] = await Promise.all([
          fetchGameForParkOnDate(park.teamId, form.visitDate),
          fetchWeatherForPark(park.lat, park.lng, form.visitDate),
        ]);

        if (cancelled) return;

        const awayPark = game ? PARKS.find(p => p.teamId === game.awayTeamId) : null;
        const awayAbbr = awayPark?.abbreviation || game?.awayTeamName;

        const updates = {
          weather:      weather ? `${weather.tempF}°F, ${weather.condition}` : '',
          gameAttended: !!game,
          opponent:     game ? game.awayTeamName : '',
          gameScore:    (game?.status === 'Final' && game.homeScore != null && game.awayScore != null)
            ? `${park.abbreviation} ${game.homeScore} - ${awayAbbr} ${game.awayScore}`
            : '',
        };

        setAutoFilled(!!game);
        setForm(prev => ({ ...prev, ...updates }));
      } catch {
        if (!cancelled) {
          setForm(prev => ({ ...prev, weather: '', opponent: '', gameScore: '' }));
          setAutoFilled(false);
        }
      } finally {
        if (!cancelled) setGameLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [form.visitDate, park.teamId, park.lat, park.lng]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    let photoKeys = form.photoKeys;

    if (pendingBlob) {
      if (API_AVAILABLE) {
        try {
          const { uploadUrl, key } = await requestUploadUrl(
            park.teamId,
            'photo.jpg',
            'image/jpeg'
          );
          await putToS3(uploadUrl, pendingBlob, 'image/jpeg');
          photoKeys = [key];
        } catch {
          addToast('Photo upload failed — saving visit without new photo', 'error');
          // Keep existing photoKeys on update, empty on new check-in
          photoKeys = form.photoKeys;
        }
      } else {
        // No API configured — fall back to base64 stored in photoKeys[0]
        try {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(pendingBlob);
          });
          photoKeys = [base64];
        } catch {
          photoKeys = [];
        }
      }
    }

    const visitData = { ...form, photoKeys };

    if (isEditing) {
      await updateVisit(visit.visitId, visitData);
      addToast(`Updated visit to ${park.venueName}`, 'success');
    } else {
      await addVisit({ parkId: park.teamId, ...visitData });
      addToast(`Checked in at ${park.venueName}!`, 'success');
    }

    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl border border-dark-600 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-dark-600">
          <div>
            <h3 className="font-bold text-lg">Check In</h3>
            <p className="text-sm text-gray-500">{park.venueName} &middot; {park.teamName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Date */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Visit Date</label>
            <input
              type="date"
              value={form.visitDate}
              onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              required
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Baseball Photo</label>
            <PhotoUploader
              currentKey={form.photoKeys[0] ?? null}
              onChange={(blob) => {
                setPendingBlob(blob);
                if (!blob) setForm(f => ({ ...f, photoKeys: [] }));
              }}
            />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Park Rating</label>
            <StarRating
              value={form.rating}
              onChange={(val) => setForm({ ...form, rating: val })}
            />
          </div>

          {/* Weather */}
          {form.weather && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Weather</label>
              <input
                type="text"
                value={form.weather}
                onChange={(e) => setForm({ ...form, weather: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Personal Notes</label>
            <textarea
              value={form.personalNote}
              onChange={(e) => setForm({ ...form, personalNote: e.target.value })}
              placeholder="What was the experience like? Any highlights?"
              rows={3}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {/* Game attended */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.gameAttended}
                onChange={(e) => setForm({ ...form, gameAttended: e.target.checked })}
                className="accent-accent w-4 h-4"
              />
              <span className="text-sm">I attended a game</span>
              {gameLoading && <Loader2 size={14} className="animate-spin text-gray-500 ml-1" />}
              {autoFilled && !gameLoading && (
                <span className="flex items-center gap-1 text-xs text-accent ml-1">
                  <Zap size={12} /> Auto-filled from MLB
                </span>
              )}
            </label>
          </div>

          {form.gameAttended && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Opponent</label>
                <input
                  type="text"
                  value={form.opponent}
                  onChange={(e) => setForm({ ...form, opponent: e.target.value })}
                  placeholder="e.g. Yankees"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Score</label>
                <input
                  type="text"
                  value={form.gameScore}
                  onChange={(e) => setForm({ ...form, gameScore: e.target.value })}
                  placeholder="e.g. BOS 5 - NYY 3"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {pendingBlob && API_AVAILABLE ? 'Uploading photo...' : 'Saving...'}
              </span>
            ) : (
              isEditing ? 'Save Changes' : 'Check In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
