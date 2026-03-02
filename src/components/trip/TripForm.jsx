import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { PARKS } from '../../data/parks';

const CITIES = [...new Set(PARKS.map(p => `${p.city}, ${p.state}`))].sort();

export default function TripForm({ onSearch, loading }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startCity, setStartCity] = useState('');
  const [dateError, setDateError] = useState('');

  const handleStartDateChange = (val) => {
    setStartDate(val);
    setDateError('');
    // If end date is empty or before the new start date, nudge it to match
    // so the end date picker opens on the same month
    if (!endDate || endDate < val) {
      setEndDate(val);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      setDateError('End date must be on or after the start date');
      return;
    }
    setDateError('');
    onSearch({ startDate, endDate, startCity });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-dark-800 rounded-xl border border-dark-600 p-6">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Plan Your Trip</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => { setEndDate(e.target.value); setDateError(''); }}
            className={`w-full bg-dark-700 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer ${dateError ? 'border-red-500' : 'border-dark-600'}`}
            required
          />
          {dateError && <p className="text-xs text-red-400 mt-1">{dateError}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Starting City</label>
          <select
            value={startCity}
            onChange={(e) => setStartCity(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Any city</option>
            {CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !startDate || !endDate}
        className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        Find Games
      </button>
    </form>
  );
}
