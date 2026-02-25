import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useVisits } from '../../hooks/useVisits';

export default function ProgressChart() {
  const { visits } = useVisits();

  if (visits.length === 0) {
    return (
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-600">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Progress Timeline</h3>
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center text-xl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Your journey starts here</p>
          <p className="text-gray-600 text-xs">Check in at a park to track your progress over time</p>
        </div>
      </div>
    );
  }

  // Build cumulative visit data
  const sorted = [...visits].sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate));
  const data = sorted.map((visit, i) => ({
    date: new Date(visit.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    parks: i + 1,
  }));

  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-600">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Progress Timeline</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <defs>
              <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8102e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#c8102e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#2a2a2a' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 30]}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1e1e1e',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
              formatter={(value) => [`${value} parks`, 'Visited']}
            />
            <Area
              type="stepAfter"
              dataKey="parks"
              stroke="#c8102e"
              strokeWidth={2}
              fill="url(#progressGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
