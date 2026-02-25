import ProgressRing from '../components/dashboard/ProgressRing';
import StatsCards from '../components/dashboard/StatsCards';
import RecentVisits from '../components/dashboard/RecentVisits';
import ProgressChart from '../components/dashboard/ProgressChart';
import { useVisits } from '../hooks/useVisits';

export default function DashboardPage() {
  const { visitedCount } = useVisits();

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Your ballpark challenge at a glance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Ring */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-600 flex items-center justify-center relative">
          <ProgressRing visited={visitedCount} />
        </div>

        {/* Stats */}
        <div className="lg:col-span-2">
          <StatsCards />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProgressChart />
        <RecentVisits />
      </div>
    </div>
  );
}
