import { Link } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';
import { useVisits } from '../../hooks/useVisits';

export default function ParkCard({ park }) {
  const { isVisited, getVisitByParkId } = useVisits();
  const visited = isVisited(park.teamId);
  const visit = getVisitByParkId(park.teamId);

  return (
    <Link
      to={`/parks/${park.teamId}`}
      className="flex items-center gap-4 bg-dark-800 border border-dark-600 rounded-xl p-4 hover:border-dark-500 transition-colors group"
    >
      <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
        <img
          src={`https://www.mlbstatic.com/team-logos/${park.teamId}.svg`}
          alt={park.abbreviation}
          className="w-8 h-8"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{park.venueName}</p>
          {visited && (
            <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full flex-shrink-0">
              Visited
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin size={12} />
          <span>{park.city}, {park.state}</span>
          <span className="mx-1">&middot;</span>
          <span>{park.teamName}</span>
        </div>
        {visit?.rating > 0 && (
          <span className="text-accent text-xs">{'★'.repeat(visit.rating)}</span>
        )}
      </div>
      <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
    </Link>
  );
}
