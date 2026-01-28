/**
 * ESPN Public API Client
 *
 * Uses ESPN's free public API - no authentication required
 * This is the same data that appears in Google search results for NBA games
 *
 * Endpoints:
 * - Scoreboard: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
 * - Team schedule: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{teamId}/schedule
 * - Game summary: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gameId}
 */

import axios from 'axios';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

const espnClient = axios.create({
  baseURL: ESPN_BASE_URL,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

/**
 * ESPN Game interface
 */
export interface ESPNGame {
  id: string;
  date: string;
  name: string; // "Team A at Team B"
  shortName: string; // "TEAM1 @ TEAM2"
  status: {
    type: {
      name: string; // "STATUS_SCHEDULED" | "STATUS_IN_PROGRESS" | "STATUS_FINAL"
      completed: boolean;
    };
  };
  competitions: Array<{
    id: string;
    date: string;
    competitors: Array<{
      id: string;
      team: {
        id: string;
        abbreviation: string;
        displayName: string;
      };
      homeAway: 'home' | 'away';
      score: string;
      winner?: boolean;
    }>;
  }>;
}

/**
 * ESPN Player Stats interface
 */
export interface ESPNPlayerStats {
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
  };
  team: {
    id: string;
    abbreviation: string;
  };
  stats: string[]; // ["MIN", "FG", "3PT", "FT", "OREB", "DREB", "REB", "AST", "STL", "BLK", "TO", "PF", "PTS"]
}

/**
 * Parsed player stats
 */
export interface ParsedPlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamAbbr: string;
  gameId: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
}

/**
 * Fetch scoreboard for a specific date
 * @param date - Date in YYYY-MM-DD format (defaults to today)
 * @returns Array of games
 */
export async function fetchESPNScoreboard(date?: string): Promise<ESPNGame[]> {
  try {
    const params: any = {};
    if (date) {
      // Convert YYYY-MM-DD to YYYYMMDD
      params.dates = date.replace(/-/g, '');
    }

    console.log(`📅 Fetching ESPN scoreboard${date ? ` for ${date}` : ''}...`);

    const response = await espnClient.get('/scoreboard', { params });
    const games = response.data?.events || [];

    console.log(`✓ Found ${games.length} games from ESPN`);
    return games;

  } catch (error) {
    console.error(`✗ Error fetching ESPN scoreboard:`, error);
    throw error;
  }
}

/**
 * Fetch detailed game summary with player stats
 * @param gameId - ESPN game ID
 * @returns Game summary with box score
 */
export async function fetchESPNGameSummary(gameId: string): Promise<any> {
  try {
    console.log(`  📊 Fetching game summary for ${gameId}...`);

    const response = await espnClient.get('/summary', {
      params: { event: gameId }
    });

    return response.data;

  } catch (error) {
    console.error(`  ✗ Error fetching game summary for ${gameId}:`, error);
    throw error;
  }
}

/**
 * Parse player stats from ESPN box score
 * @param boxscore - ESPN boxscore data
 * @param gameId - Game ID
 * @returns Array of parsed player stats
 */
export function parseESPNPlayerStats(boxscore: any, gameId: string): ParsedPlayerStats[] {
  const playerStats: ParsedPlayerStats[] = [];

  try {
    // ESPN structure: boxscore.players = [{team, statistics}]
    const players = boxscore?.players || [];

    for (const teamData of players) {
      const teamId = teamData.team?.id;
      const teamAbbr = teamData.team?.abbreviation;

      if (!teamId || !teamAbbr) continue;

      // Get statistics (contains names array and athletes array)
      const statistics = teamData.statistics || [];

      for (const stat of statistics) {
        const names = stat.names || []; // ["MIN", "PTS", "FG", "3PT", "FT", "REB", "AST", ...]
        const athletes = stat.athletes || [];

        // Find indices for stats we need
        const minIdx = names.indexOf('MIN');
        const ptsIdx = names.indexOf('PTS');
        const rebIdx = names.indexOf('REB');
        const astIdx = names.indexOf('AST');

        if (minIdx === -1 || ptsIdx === -1 || rebIdx === -1 || astIdx === -1) {
          console.warn('  ⚠️  Could not find required stat indices');
          continue;
        }

        for (const athleteData of athletes) {
          const athlete = athleteData.athlete;
          const stats = athleteData.stats || [];

          if (!athlete || stats.length === 0) continue;

          const minutes = parseMinutes(stats[minIdx] || '0');
          const points = parseInt(stats[ptsIdx]) || 0;
          const rebounds = parseInt(stats[rebIdx]) || 0;
          const assists = parseInt(stats[astIdx]) || 0;

          playerStats.push({
            playerId: athlete.id,
            playerName: athlete.displayName,
            teamId: teamId,
            teamAbbr: teamAbbr,
            gameId: gameId,
            minutes,
            points,
            rebounds,
            assists
          });
        }
      }
    }

    console.log(`  ✓ Parsed ${playerStats.length} player stats`);
    return playerStats;

  } catch (error) {
    console.error('  ✗ Error parsing player stats:', error);
    return [];
  }
}

/**
 * Parse minutes from ESPN format
 * ESPN uses format like "35" or "35:20"
 */
function parseMinutes(minStr: string): number {
  if (!minStr || minStr === '-' || minStr === 'DNP') return 0;

  if (minStr.includes(':')) {
    const parts = minStr.split(':');
    return parseInt(parts[0]) || 0;
  }

  return parseInt(minStr) || 0;
}

/**
 * Convert ESPN game to our format
 */
export function convertESPNGame(espnGame: ESPNGame): {
  gameId: string;
  gameDate: string;
  gameTime: string;
  status: string;
  homeTeam: { id: string; abbreviation: string; name: string; score?: number };
  awayTeam: { id: string; abbreviation: string; name: string; score?: number };
} {
  const competition = espnGame.competitions[0];
  const homeTeam = competition.competitors.find(c => c.homeAway === 'home')!;
  const awayTeam = competition.competitors.find(c => c.homeAway === 'away')!;

  let status = 'scheduled';
  if (espnGame.status.type.name === 'STATUS_FINAL') {
    status = 'final';
  } else if (espnGame.status.type.name === 'STATUS_IN_PROGRESS') {
    status = 'live';
  }

  return {
    gameId: espnGame.id,
    gameDate: espnGame.date.split('T')[0],
    gameTime: espnGame.date,
    status,
    homeTeam: {
      id: homeTeam.team.id,
      abbreviation: homeTeam.team.abbreviation,
      name: homeTeam.team.displayName,
      score: parseInt(homeTeam.score) || undefined
    },
    awayTeam: {
      id: awayTeam.team.id,
      abbreviation: awayTeam.team.abbreviation,
      name: awayTeam.team.displayName,
      score: parseInt(awayTeam.score) || undefined
    }
  };
}

/**
 * Get completed games for a specific date
 */
export async function fetchCompletedGames(date: string): Promise<any[]> {
  const allGames = await fetchESPNScoreboard(date);
  const completedGames = allGames.filter(g => g.status.type.completed);

  console.log(`✓ Found ${completedGames.length} completed games on ${date}`);
  return completedGames.map(g => convertESPNGame(g));
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayEST(): string {
  // ESPN uses Eastern Time (EST/EDT)
  const now = new Date();
  const estOffset = -5 * 60 * 60 * 1000; // EST is UTC-5
  const estTime = new Date(now.getTime() + estOffset);
  return estTime.toISOString().split('T')[0];
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export function getYesterdayEST(): string {
  const now = new Date();
  const estOffset = -5 * 60 * 60 * 1000;
  const estTime = new Date(now.getTime() + estOffset);
  estTime.setDate(estTime.getDate() - 1);
  return estTime.toISOString().split('T')[0];
}
