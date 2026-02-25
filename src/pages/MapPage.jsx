import { useVisits } from '../hooks/useVisits';
import BallparkMap from '../components/map/BallparkMap';

export default function MapPage() {
  const { visitedCount } = useVisits();

  return (
    <div className="h-[calc(100vh-56px)] lg:h-screen relative">
      <BallparkMap />
      {/* Floating legend */}
      <div className="absolute top-4 right-4 bg-dark-800/90 backdrop-blur-sm border border-dark-600 rounded-xl p-4 z-[1000]">
        <h3 className="text-sm font-medium mb-3">Ballparks</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-gray-300">Visited ({visitedCount})</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-dark-600 border border-dark-500" />
            <span className="text-gray-300">Not visited ({30 - visitedCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
