import { MapPin, Star, Calendar, Flag } from 'lucide-react';
import { useVisits } from '../../hooks/useVisits';
import { useApp } from '../../context/AppContext';

export default function StatsCards() {
  const { visitedCount, uniqueStates, averageRating, visits } = useVisits();
  const { state } = useApp();

  const lastVisit = visits.length > 0
    ? [...visits].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))[0]
    : null;

  const lastPark = lastVisit ? state.parks.find(p => p.teamId === lastVisit.parkId) : null;

  // Only show average for visits that actually have a rating
  const ratedVisits = visits.filter(v => v.rating > 0);
  const displayRating = ratedVisits.length > 0
    ? (ratedVisits.reduce((sum, v) => sum + v.rating, 0) / ratedVisits.length).toFixed(1)
    : null;

  const stats = [
    {
      icon: MapPin,
      label: 'Parks Visited',
      value: visitedCount,
      sub: `${30 - visitedCount} remaining`,
    },
    {
      icon: Flag,
      label: 'States Covered',
      value: uniqueStates.length,
      sub: `of 50 states + DC`,
    },
    {
      icon: Star,
      label: 'Avg Rating',
      value: displayRating || '—',
      sub: ratedVisits.length > 0 ? `from ${ratedVisits.length} rated` : 'no ratings yet',
    },
    {
      icon: Calendar,
      label: 'Last Visit',
      value: lastVisit
        ? new Date(lastVisit.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—',
      sub: lastPark ? lastPark.venueName : 'plan your first trip',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, label, value, sub }) => (
        <div key={label} className="bg-dark-800 rounded-xl p-4 border border-dark-600">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={16} className="text-accent" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
          </div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{sub}</p>
        </div>
      ))}
    </div>
  );
}
