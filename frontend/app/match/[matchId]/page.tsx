'use client';

import { useState, useEffect } from 'react';
import { fetchPredictions } from '@/lib/apiClient';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Prediction {
  playerId: number;
  playerName: string;
  team: string;
  status: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  gamesAnalyzed: number;
}

// Helper to get badge class based on threshold value
function getBadgeClass(value: number | null, type: 'points' | 'rebounds' | 'assists'): string {
  if (!value) return 'badge-gray';

  if (type === 'points') {
    if (value >= 30) return 'badge-green';
    if (value >= 25) return 'badge-blue';
    if (value >= 20) return 'badge-purple';
    if (value >= 15) return 'badge-yellow';
    return 'badge-gray';
  }

  if (type === 'rebounds') {
    if (value >= 12) return 'badge-green';
    if (value >= 10) return 'badge-blue';
    if (value >= 8) return 'badge-purple';
    if (value >= 6) return 'badge-yellow';
    return 'badge-gray';
  }

  if (type === 'assists') {
    if (value >= 10) return 'badge-green';
    if (value >= 8) return 'badge-blue';
    if (value >= 6) return 'badge-purple';
    if (value >= 4) return 'badge-yellow';
    return 'badge-gray';
  }

  return 'badge-gray';
}

export default function MatchDetail() {
  const params = useParams();
  const matchId = parseInt(params.matchId as string);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPredictions();
  }, [matchId]);

  async function loadPredictions() {
    setLoading(true);

    try {
      const result = await fetchPredictions(matchId);
      setAvailable(result.predictionsAvailable);
      setMessage(result.message || '');
      setPredictions(result.data || []);
    } catch (error) {
      console.error('Error loading predictions:', error);
      setMessage('Failed to load predictions');
    } finally {
      setLoading(false);
    }
  }

  // Sort: Players with predictions first, then by points (highest first)
  const sortedPredictions = [...predictions].sort((a, b) => {
    // Check if player has any predictions
    const aHasPrediction = a.points !== null || a.rebounds !== null || a.assists !== null;
    const bHasPrediction = b.points !== null || b.rebounds !== null || b.assists !== null;

    // Players with predictions come first
    if (aHasPrediction && !bHasPrediction) return -1;
    if (!aHasPrediction && bHasPrediction) return 1;

    // Within each group, sort by points (highest first)
    const aVal = a.points || 0;
    const bVal = b.points || 0;
    return bVal - aVal;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
          <p className="mt-4 text-xl text-gray-400">Loading predictions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-400 hover:text-white transition mb-6 animate-fade-in"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Matches
        </Link>

        {/* Header */}
        <div className="mb-8 animate-scale-in">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            <span className="text-gradient">Match Predictions</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Based on last 15 games performance
          </p>
        </div>

        {!available ? (
          /* Coming Soon Message */
          <div className="card p-8 animate-fade-in">
            <div className="flex items-start space-x-4">
              <div className="text-4xl">⏰</div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {message}
                </h3>
                <p className="text-gray-400 text-lg">
                  Predictions are only available for matches within 24 hours of game time.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Predictions Table */}
            <div className="card overflow-hidden animate-fade-in">
              {sortedPredictions.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    No Predictions Available
                  </h3>
                  <p className="text-gray-400">
                    Players need at least 15 games of historical data.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th className="text-left">PLAYER</th>
                        <th className="text-left">TEAM</th>
                        <th className="text-center">POINTS</th>
                        <th className="text-center">REBOUNDS</th>
                        <th className="text-center">ASSISTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPredictions.map((pred) => (
                        <tr key={pred.playerId}>
                          <td className="font-bold text-white">
                            <Link
                              href={`/players/${pred.playerId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                            >
                              {pred.playerName}
                            </Link>
                            {pred.status !== 'active' && (
                              <div className="text-xs text-red-400 font-normal mt-1">
                                Not Expected to Play
                              </div>
                            )}
                          </td>
                          <td className="font-semibold text-gray-300">
                            {pred.team}
                          </td>
                          <td className="text-center">
                            {pred.points ? (
                              <span className={`badge ${getBadgeClass(pred.points, 'points')}`}>
                                {pred.points}+
                              </span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="text-center">
                            {pred.rebounds ? (
                              <span className={`badge ${getBadgeClass(pred.rebounds, 'rebounds')}`}>
                                {pred.rebounds}+
                              </span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="text-center">
                            {pred.assists ? (
                              <span className={`badge ${getBadgeClass(pred.assists, 'assists')}`}>
                                {pred.assists}+
                              </span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info Box */}
            {sortedPredictions.length > 0 && (
              <div className="card p-6 mt-6 animate-fade-in">
                <h3 className="font-bold text-white text-lg mb-4">
                  📖 How Predictions Work
                </h3>
                <div className="space-y-3 text-gray-300">
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-3">•</span>
                    <p>Based on <span className="font-semibold text-white">last 15 team games</span> performance</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-3">•</span>
                    <p>Thresholds show where player hit the mark in <span className="font-semibold text-white">14+ out of 15 games</span></p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-3">•</span>
                    <p>No machine learning or betting odds - pure statistical analysis</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
