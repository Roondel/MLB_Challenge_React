import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useVisits } from '../hooks/useVisits';
import PhotoCard from '../components/gallery/PhotoCard';

const FILTERS = ['All', 'Visited', 'Not Visited'];

export default function GalleryPage() {
  const { state } = useApp();
  const { getVisitByParkId, visitedCount } = useVisits();
  const [filter, setFilter] = useState('All');

  const parks = state.parks.filter(park => {
    const visit = getVisitByParkId(park.teamId);
    if (filter === 'Visited') return !!visit;
    if (filter === 'Not Visited') return !visit;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Baseball Collection</h2>
          <p className="text-gray-500 text-sm mt-1">{visitedCount} of 30 baseballs collected</p>
        </div>
        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-accent text-white'
                  : 'bg-dark-800 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {parks.map(park => (
          <PhotoCard
            key={park.teamId}
            park={park}
            visit={getVisitByParkId(park.teamId)}
          />
        ))}
      </div>

      {parks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No parks match this filter</p>
        </div>
      )}
    </div>
  );
}
