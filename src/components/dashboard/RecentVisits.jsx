import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import { useVisits } from '../../hooks/useVisits';
import { useApp } from '../../context/AppContext';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import { getTeamLogoUrl } from '../../data/parks';

// Extracted so usePhotoUrl can be called per row (hooks can't be used inside .map())
function RecentVisitRow({ visit, park }) {
  const rawKey = visit?.photoKeys?.[0];
  const isBase64 = rawKey?.startsWith('data:image/');
  const resolvedS3Url = usePhotoUrl(!isBase64 ? rawKey : null);

  const photoSrc = resolvedS3Url
    ?? (isBase64 ? rawKey : null)
    ?? visit?.baseballPhotoBase64
    ?? null;

  return (
    <Link
      to={`/parks/${visit.parkId}`}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-700 transition-colors group"
    >
      {photoSrc ? (
        <img
          src={photoSrc}
          alt="Baseball"
          className="w-12 h-12 rounded-lg object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center">
          <img
            src={getTeamLogoUrl(visit.parkId)}
            alt={park?.abbreviation}
            className="w-8 h-8"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{park?.venueName}</p>
        <p className="text-xs text-gray-500">{park?.teamName} &middot; {new Date(visit.visitDate).toLocaleDateString()}</p>
      </div>
      <div className="flex items-center gap-1">
        {visit.rating > 0 && (
          <span className="text-accent text-sm">{'★'.repeat(visit.rating)}</span>
        )}
        <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400" />
      </div>
    </Link>
  );
}

export default function RecentVisits() {
  const { visits } = useVisits();
  const { state } = useApp();

  const recent = [...visits]
    .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
    .slice(0, 3);

  if (recent.length === 0) {
    return (
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-600">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Recent Visits</h3>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center">
            <MapPin size={20} className="text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm">No visits yet</p>
          <Link to="/map" className="inline-flex items-center gap-1 text-accent text-sm hover:underline">
            Explore the map to get started
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-600">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Recent Visits</h3>
      <div className="space-y-3">
        {recent.map(visit => {
          const park = state.parks.find(p => p.teamId === visit.parkId);
          return <RecentVisitRow key={visit.visitId} visit={visit} park={park} />;
        })}
      </div>
    </div>
  );
}
