import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import { useVisits } from '../../hooks/useVisits';
import { useApp } from '../../context/AppContext';

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
          return (
            <Link
              key={visit.visitId}
              to={`/parks/${visit.parkId}`}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-700 transition-colors group"
            >
              {visit.baseballPhotoBase64 ? (
                <img
                  src={visit.baseballPhotoBase64}
                  alt="Baseball"
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center">
                  <img
                    src={`https://www.mlbstatic.com/team-logos/${visit.parkId}.svg`}
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
        })}
      </div>
    </div>
  );
}
