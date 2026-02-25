import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Plane, Camera } from 'lucide-react';
import { useVisits } from '../../hooks/useVisits';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/trip', icon: Plane, label: 'Trip Planner' },
  { to: '/gallery', icon: Camera, label: 'Gallery' },
];

export default function Sidebar() {
  const { visitedCount } = useVisits();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-dark-800 border-r border-dark-600 h-screen sticky top-0">
      <div className="p-6 border-b border-dark-600">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-accent">30</span> Ballpark Challenge
        </h1>
        <p className="text-sm text-gray-500 mt-1">{visitedCount}/30 visited</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-dark-600">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">MLB API Connected</span>
        </div>
      </div>
    </aside>
  );
}
