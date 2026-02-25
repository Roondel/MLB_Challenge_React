import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';

export default function PhotoCard({ park, visit }) {
  const hasPhoto = visit?.baseballPhotoBase64;

  return (
    <Link
      to={`/parks/${park.teamId}`}
      className="group relative aspect-square rounded-xl overflow-hidden border border-dark-600 hover:border-dark-500 transition-colors"
    >
      {hasPhoto ? (
        <img
          src={visit.baseballPhotoBase64}
          alt={`Baseball from ${park.venueName}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full bg-dark-800 flex flex-col items-center justify-center gap-2">
          <img
            src={`https://www.mlbstatic.com/team-logos/${park.teamId}.svg`}
            alt={park.abbreviation}
            className={`w-10 h-10 ${visit ? 'opacity-50' : 'opacity-20'}`}
          />
          {!visit && (
            <Camera size={14} className="text-gray-600" />
          )}
        </div>
      )}
      {/* Overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
        <p className="text-xs font-medium truncate">{park.venueName}</p>
        <p className="text-xs text-gray-400 truncate">{park.abbreviation}</p>
      </div>
      {/* Visited badge */}
      {visit && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
      )}
    </Link>
  );
}
