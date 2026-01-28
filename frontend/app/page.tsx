'use client';

import { useState, useEffect } from 'react';
import { fetchMatches } from '@/lib/apiClient';
import Link from 'next/link';

interface Match {
  id: number;
  matchId: string;
  gameDate: string;
  gameTime: string;
  status: string;
  season: string;
  homeTeam: {
    id: number;
    name: string;
    abbreviation: string;
  };
  awayTeam: {
    id: number;
    name: string;
    abbreviation: string;
  };
}

export default function Home() {
  const [date, setDate] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [minDate, setMinDate] = useState('');

  // Set default date and minimum date based on IST time
  useEffect(() => {
    // Get current time in IST
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentHour = istTime.getHours();

    // If after 12:00 Noon IST, use tomorrow; otherwise use today
    let targetDate = new Date(istTime);
    if (currentHour >= 12) {
      // After noon, default to tomorrow
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    setMinDate(dateStr);
    setDate(dateStr);
  }, []);

  useEffect(() => {
    if (date) {
      loadMatches();
    }
  }, [date]);

  async function loadMatches() {
    setLoading(true);
    setError('');

    try {
      const result = await fetchMatches(date);
      setMatches(result.data || []);
    } catch (err) {
      console.error('Error loading matches:', err);
      setError('Failed to load matches. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const formattedDate = date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            <span className="text-gradient">Today's Matches</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Select a date to view scheduled NBA games and get predictions
          </p>
        </div>

        {/* Date Picker Card */}
        <div className="card p-6 mb-8 animate-scale-in">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-400 uppercase mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={date}
                min={minDate}
                onChange={(e) => setDate(e.target.value)}
                className="input-modern"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="card p-6 mb-6 border-red-500/50 bg-red-500/10 animate-fade-in">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-red-400 font-semibold mb-1">Error Loading Matches</h3>
                <p className="text-red-300/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-4 animate-fade-in">
            <div className="skeleton h-8 w-64 mb-6"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-3">
                    <div className="skeleton h-8 w-48"></div>
                    <div className="skeleton h-5 w-64"></div>
                  </div>
                  <div className="skeleton h-6 w-24"></div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="skeleton h-5 w-36"></div>
                </div>
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          /* Empty State */
          <div className="card p-12 text-center animate-fade-in">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              No Matches Found
            </h3>
            <p className="text-gray-400 text-lg mb-1">
              No games scheduled for {formattedDate || 'this date'}
            </p>
            <p className="text-gray-500">
              Try selecting a different date to find scheduled matches
            </p>
          </div>
        ) : (
          /* Matches List */
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-white">
                {matches.length} {matches.length === 1 ? 'Match' : 'Matches'} on {formattedDate}
              </h2>
            </div>

            <div className="grid gap-4">
              {matches.map((match, index) => (
                <Link
                  key={match.id}
                  href={`/match/${match.id}`}
                  className="card p-6 group cursor-pointer animate-slide-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    {/* Teams */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="text-center">
                          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                            {match.awayTeam.abbreviation}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Away</div>
                        </div>

                        <div className="flex flex-col items-center px-4">
                          <span className="text-gray-600 text-sm font-semibold mb-1">VS</span>
                          <div className="w-12 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                        </div>

                        <div className="text-center">
                          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                            {match.homeTeam.abbreviation}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Home</div>
                        </div>
                      </div>

                      <div className="text-gray-400 text-sm">
                        {match.awayTeam.name} at {match.homeTeam.name}
                      </div>
                    </div>

                    {/* Game Info */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-300 font-semibold">
                          {new Date(match.gameTime).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })} IST
                        </span>
                      </div>

                      <span className={`badge ${
                        match.status === 'scheduled' ? 'badge-blue' :
                        match.status === 'live' ? 'badge-green' :
                        match.status === 'final' ? 'badge-gray' :
                        'badge-yellow'
                      }`}>
                        {match.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* View Predictions Button */}
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-semibold group-hover:text-blue-300 transition-colors flex items-center space-x-2">
                        <span>View Predictions</span>
                        <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>

                      <div className="flex items-center space-x-2 text-gray-500 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Player Props</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
