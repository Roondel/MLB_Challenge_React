import { useVisits } from '../../hooks/useVisits';

export default function Header({ title }) {
  const { visitedCount } = useVisits();

  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-dark-600 sticky top-0 z-40">
      <h1 className="text-lg font-bold tracking-tight">
        <span className="text-accent">30</span> Ballpark
      </h1>
      <div className="flex items-center gap-2 bg-dark-700 px-3 py-1 rounded-full">
        <span className="text-accent font-bold text-sm">{visitedCount}</span>
        <span className="text-gray-500 text-xs">/30</span>
      </div>
    </header>
  );
}
