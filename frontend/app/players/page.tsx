'use client';

import { useState, useEffect } from 'react';
import { searchPlayers, fetchPlayerStats } from '@/lib/apiClient';

interface Player {
  id: number;
  nbaPlayerId: number;
  firstName: string;
  lastName: string;
  name: string;
  position: string;
  team: string;
  teamName: string;
}

interface PlayerStat {
  date: string;
  opponent: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  isImputed: boolean;
}

export default function PlayerResearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Search players as user types
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  async function handleSearch() {
    setLoading(true);
    try {
      const result = await searchPlayers(searchQuery);
      setSearchResults(result.data || []);
    } catch (error) {
      console.error('Error searching players:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectPlayer(player: Player) {
    setSelectedPlayer(player);
    setStatsLoading(true);
    setSearchResults([]);
    setSearchQuery(player.name);

    try {
      const result = await fetchPlayerStats(player.id);
      setPlayerStats(result.data?.stats || []);
    } catch (error) {
      console.error('Error fetching player stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }

  // Calculate averages
  const averages = playerStats.length > 0 ? {
    minutes: Math.round(playerStats.reduce((sum, s) => sum + s.minutes, 0) / playerStats.length),
    points: Math.round(playerStats.reduce((sum, s) => sum + s.points, 0) / playerStats.length),
    rebounds: Math.round(playerStats.reduce((sum, s) => sum + s.rebounds, 0) / playerStats.length),
    assists: Math.round(playerStats.reduce((sum, s) => sum + s.assists, 0) / playerStats.length)
  } : null;

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            <span className="text-gradient">Player Research</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Search for any player and view their last 15 games statistics
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-8 animate-scale-in">
          <div className="card p-6">
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Search Player
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type player name (e.g., LeBron, Curry, Davis)..."
                className="input-modern"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔍
              </div>
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-4 card p-2 max-h-96 overflow-y-auto">
                <div className="text-xs text-gray-400 px-3 py-2">
                  Found {searchResults.length} player{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => selectPlayer(player)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-surface-hover transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {player.name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {player.position} • {player.teamName}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-gray-600 group-hover:text-blue-500 transition-colors">
                      {player.team}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {loading && searchQuery.length >= 2 && (
              <div className="mt-4 text-center text-gray-400">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-sm">Searching...</p>
              </div>
            )}

            {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="mt-4 text-center text-gray-400 py-8">
                <p className="text-lg">No players found matching "{searchQuery}"</p>
                <p className="text-sm mt-2">Try a different name or check spelling</p>
              </div>
            )}
          </div>
        </div>

        {/* Player Stats Table */}
        {selectedPlayer && (
          <div className="animate-fade-in">
            <div className="card p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {selectedPlayer.name}
                  </h2>
                  <div className="flex items-center space-x-4 text-gray-400">
                    <span className="badge badge-blue">
                      {selectedPlayer.position}
                    </span>
                    <span className="text-lg font-bold text-gradient">
                      {selectedPlayer.team}
                    </span>
                    <span>{selectedPlayer.teamName}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlayer(null);
                    setPlayerStats([]);
                    setSearchQuery('');
                  }}
                  className="btn-secondary"
                >
                  ← Back to Search
                </button>
              </div>

              {statsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
                  <p className="mt-4 text-gray-400">Loading player stats...</p>
                </div>
              ) : playerStats.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg">No stats available for this player</p>
                  <p className="text-sm mt-2">Player needs at least 15 games of data</p>
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
                      {playerStats.map((stat, idx) => (
                        <tr key={idx} className={stat.isImputed ? 'opacity-60' : ''}>
                          <td className="font-medium text-gray-300">
                            {new Date(stat.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="font-semibold text-white">
                            vs {stat.opponent}
                          </td>
                          <td className="text-center text-gray-300">
                            {stat.minutes}
                            {stat.isImputed && (
                              <span className="text-xs text-yellow-500 ml-1">*</span>
                            )}
                          </td>
                          <td className="text-center">
                            <span className="badge badge-blue">{stat.points}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge badge-green">{stat.rebounds}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge badge-purple">{stat.assists}</span>
                          </td>
                        </tr>
                      ))}
                      {averages && (
                        <tr className="bg-surface-hover font-bold">
                          <td colSpan={2} className="text-right text-yellow-500 uppercase text-sm">
                            Average
                          </td>
                          <td className="text-center text-gray-300">{averages.minutes}</td>
                          <td className="text-center">
                            <span className="badge badge-blue">{averages.points}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge badge-green">{averages.rebounds}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge badge-purple">{averages.assists}</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {playerStats.some(s => s.isImputed) && (
                    <div className="mt-4 text-sm text-gray-400">
                      <span className="text-yellow-500">*</span> Imputed stats (player did not play)
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedPlayer && searchQuery.length < 2 && (
          <div className="card p-12 text-center animate-fade-in">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Search for a Player
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter a player's name in the search box above to view their last 15 games statistics
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
