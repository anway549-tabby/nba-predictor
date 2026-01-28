'use client';

import { useState, useEffect } from 'react';
import { fetchPlayerStats } from '@/lib/apiClient';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface PlayerStat {
  date: string;
  opponent: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  isImputed: boolean;
}

interface PlayerInfo {
  id: number;
  name: string;
  position: string;
  team: string;
}

export default function PlayerDetail() {
  const params = useParams();
  const playerId = parseInt(params.playerId as string);

  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlayerStats();
  }, [playerId]);

  async function loadPlayerStats() {
    setLoading(true);
    setError('');

    try {
      const result = await fetchPlayerStats(playerId);

      if (result.player) {
        setPlayer({
          id: result.player.id,
          name: `${result.player.firstName} ${result.player.lastName}`,
          position: result.player.position,
          team: result.player.team
        });
      }

      setStats(result.data?.stats || []);
    } catch (err) {
      console.error('Error loading player stats:', err);
      setError('Failed to load player statistics');
    } finally {
      setLoading(false);
    }
  }

  // Calculate averages
  const averages = stats.length > 0 ? {
    minutes: (stats.reduce((sum, s) => sum + s.minutes, 0) / stats.length).toFixed(1),
    points: (stats.reduce((sum, s) => sum + s.points, 0) / stats.length).toFixed(1),
    rebounds: (stats.reduce((sum, s) => sum + s.rebounds, 0) / stats.length).toFixed(1),
    assists: (stats.reduce((sum, s) => sum + s.assists, 0) / stats.length).toFixed(1)
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
          <p className="mt-4 text-xl text-gray-400">Loading player stats...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-2xl font-bold text-white mb-2">Player Not Found</h3>
          <p className="text-gray-400 mb-4">{error || 'Unable to load player statistics'}</p>
          <Link href="/players" className="btn-primary">
            Search Players
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            <span className="text-gradient">{player.name}</span>
          </h1>
          <div className="flex items-center gap-4 text-gray-400">
            <span className="text-lg">{player.team}</span>
            <span className="text-gray-600">•</span>
            <span className="text-lg">{player.position}</span>
          </div>
        </div>

        {/* Averages Card */}
        {averages && (
          <div className="card p-6 mb-8 animate-scale-in">
            <h3 className="text-xl font-bold text-white mb-4">Season Averages (Last {stats.length} Games)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{averages.minutes}</div>
                <div className="text-sm text-gray-400 mt-1">MIN/G</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{averages.points}</div>
                <div className="text-sm text-gray-400 mt-1">PTS/G</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">{averages.rebounds}</div>
                <div className="text-sm text-gray-400 mt-1">REB/G</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">{averages.assists}</div>
                <div className="text-sm text-gray-400 mt-1">AST/G</div>
              </div>
            </div>
          </div>
        )}

        {/* Game Log */}
        <div className="card overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-white/10">
            <h3 className="text-xl font-bold text-white">Game Log</h3>
          </div>

          {stats.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Stats Available</h3>
              <p className="text-gray-400">This player doesn't have any recorded statistics yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th className="text-left">DATE</th>
                    <th className="text-left">OPPONENT</th>
                    <th className="text-center">MIN</th>
                    <th className="text-center">PTS</th>
                    <th className="text-center">REB</th>
                    <th className="text-center">AST</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, index) => (
                    <tr key={index}>
                      <td className="text-gray-300">
                        {new Date(stat.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="font-semibold text-white">
                        {stat.opponent}
                      </td>
                      <td className="text-center text-gray-300">{stat.minutes}</td>
                      <td className="text-center font-bold text-green-400">{stat.points}</td>
                      <td className="text-center font-bold text-purple-400">{stat.rebounds}</td>
                      <td className="text-center font-bold text-orange-400">{stat.assists}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Note */}
        {stats.length > 0 && (
          <div className="card p-4 mt-6 animate-fade-in">
            <p className="text-sm text-gray-400">
              📝 Showing last {stats.length} games. Statistics updated daily at 12:00 Noon IST.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
