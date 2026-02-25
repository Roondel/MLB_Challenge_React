import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Plane, Camera } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/trip', icon: Plane, label: 'Trip' },
  { to: '/gallery', icon: Camera, label: 'Gallery' },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 z-50">
      <div className="flex justify-around py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors ${
                isActive ? 'text-accent' : 'text-gray-500'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
