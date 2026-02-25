import { useState } from 'react';
import { X } from 'lucide-react';
import StarRating from './StarRating';
import PhotoUploader from './PhotoUploader';
import { useVisits } from '../../hooks/useVisits';
import { useToast } from '../layout/Toast';

export default function CheckInModal({ park, onClose }) {
  const { addVisit } = useVisits();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    visitDate: new Date().toISOString().split('T')[0],
    baseballPhotoBase64: null,
    personalNote: '',
    rating: 0,
    gameAttended: false,
    opponent: '',
    gameScore: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    addVisit({
      parkId: park.teamId,
      ...form,
    });
    addToast(`Checked in at ${park.venueName}!`, 'success');
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
              value={form.baseballPhotoBase64}
              onChange={(val) => setForm({ ...form, baseballPhotoBase64: val })}
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
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-lg transition-colors"
          >
            Check In
          </button>
        </form>
      </div>
    </div>
  );
}
