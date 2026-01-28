/**
 * Free NBA Data Client
 *
 * Uses NBA.com's public APIs (no authentication required)
 * - Schedule from cdn.nba.com
 * - Player stats from stats.nba.com
 *
 * These are the same APIs that power NBA.com and are completely free
 */

import axios from 'axios';

// NBA.com public APIs
const SCHEDULE_BASE_URL = 'https://cdn.nba.com/static/json/liveData';
const STATS_BASE_URL = 'https://stats.nba.com/stats';

// Create axios instance with required headers (NBA.com checks these)
const statsClient = axios.create({
  baseURL: STATS_BASE_URL,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'Accept': 'application/json'
  }
});

const scheduleClient = axios.create({
  baseURL: SCHEDULE_BASE_URL,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

/**
 * NBA Team mapping (NBA.com team IDs)
 */
export const NBA_TEAMS: Record<number, { abbr: string; name: string }> = {
  1610612737: { abbr: 'ATL', name: 'Atlanta Hawks' },
  1610612738: { abbr: 'BOS', name: 'Boston Celtics' },
  1610612751: { abbr: 'BKN', name: 'Brooklyn Nets' },
  1610612766: { abbr: 'CHA', name: 'Charlotte Hornets' },
  1610612741: { abbr: 'CHI', name: 'Chicago Bulls' },
  1610612739: { abbr: 'CLE', name: 'Cleveland Cavaliers' },
  1610612742: { abbr: 'DAL', name: 'Dallas Mavericks' },
  1610612743: { abbr: 'DEN', name: 'Denver Nuggets' },
  1610612765: { abbr: 'DET', name: 'Detroit Pistons' },
  1610612744: { abbr: 'GSW', name: 'Golden State Warriors' },
  1610612745: { abbr: 'HOU', name: 'Houston Rockets' },
  1610612754: { abbr: 'IND', name: 'Indiana Pacers' },
  1610612746: { abbr: 'LAC', name: 'LA Clippers' },
  1610612747: { abbr: 'LAL', name: 'Los Angeles Lakers' },
  1610612763: { abbr: 'MEM', name: 'Memphis Grizzlies' },
  1610612748: { abbr: 'MIA', name: 'Miami Heat' },
  1610612749: { abbr: 'MIL', name: 'Milwaukee Bucks' },
  1610612750: { abbr: 'MIN', name: 'Minnesota Timberwolves' },
  1610612740: { abbr: 'NOP', name: 'New Orleans Pelicans' },
  1610612752: { abbr: 'NYK', name: 'New York Knicks' },
  1610612760: { abbr: 'OKC', name: 'Oklahoma City Thunder' },
  1610612753: { abbr: 'ORL', name: 'Orlando Magic' },
  1610612755: { abbr: 'PHI', name: 'Philadelphia 76ers' },
  1610612756: { abbr: 'PHX', name: 'Phoenix Suns' },
  1610612757: { abbr: 'POR', name: 'Portland Trail Blazers' },
  1610612758: { abbr: 'SAC', name: 'Sacramento Kings' },
  1610612759: { abbr: 'SAS', name: 'San Antonio Spurs' },
  1610612761: { abbr: 'TOR', name: 'Toronto Raptors' },
  1610612762: { abbr: 'UTA', name: 'Utah Jazz' },
  1610612764: { abbr: 'WAS', name: 'Washington Wizards' }
};

/**
 * Game interface
 */
export interface FreeNBAGame {
  gameId: string;
  gameDate: string; // YYYY-MM-DD
  gameTime: string; // ISO string
  status: string; // 'scheduled' | 'live' | 'final'
  homeTeam: {
    teamId: number;
    abbreviation: string;
    name: string;
    score?: number;
  };
  awayTeam: {
    teamId: number;
    abbreviation: string;
    name: string;
    score?: number;
  };
}

/**
 * Player stat interface
 */
export interface FreeNBAPlayerStat {
  playerId: number;
  playerName: string;
  teamId: number;
  teamAbbr: string;
  gameId: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
}

/**
 * Fetch schedule for a specific date
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of games
 */
export async function fetchScheduleForDate(date: string): Promise<FreeNBAGame[]> {
  try {
    // Convert date to scoreboardDate format (YYYYMMDD)
    const scoreboardDate = date.replace(/-/g, '');

    console.log(`📅 Fetching schedule for ${date}...`);

    // NBA.com scoreboard endpoint
    const url = `/scoreboard/scoreboard_${scoreboardDate}.json`;
    const response = await scheduleClient.get(url);

    const games: FreeNBAGame[] = [];
    const gameData = response.data?.scoreboard?.games || [];

    for (const game of gameData) {
      const homeTeam = NBA_TEAMS[game.homeTeam.teamId];
      const awayTeam = NBA_TEAMS[game.awayTeam.teamId];

      if (!homeTeam || !awayTeam) {
        console.warn(`Unknown team ID: ${game.homeTeam.teamId} or ${game.awayTeam.teamId}`);
        continue;
      }

      games.push({
        gameId: game.gameId,
        gameDate: date,
        gameTime: game.gameTimeUTC || new Date(date).toISOString(),
        status: game.gameStatus === 1 ? 'scheduled' : game.gameStatus === 2 ? 'live' : 'final',
        homeTeam: {
          teamId: game.homeTeam.teamId,
          abbreviation: homeTeam.abbr,
          name: homeTeam.name,
          score: game.homeTeam.score
        },
        awayTeam: {
          teamId: game.awayTeam.teamId,
          abbreviation: awayTeam.abbr,
          name: awayTeam.name,
          score: game.awayTeam.score
        }
      });
    }

    console.log(`✓ Found ${games.length} games for ${date}`);
    return games;

  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.log(`ℹ️  No games found for ${date} (404)`);
      return [];
    }
    console.error(`✗ Error fetching schedule for ${date}:`, error);
    throw error;
  }
}

/**
 * Fetch player stats for a specific game
 * @param gameId - NBA game ID (e.g., "0022500001")
 * @returns Array of player stats
 */
export async function fetchPlayerStatsForGame(gameId: string): Promise<FreeNBAPlayerStat[]> {
  try {
    console.log(`  📊 Fetching player stats for game ${gameId}...`);

    // Box score traditional endpoint
    const response = await statsClient.get('/boxscoretraditionalv2', {
      params: {
        GameID: gameId,
        StartPeriod: 0,
        EndPeriod: 10,
        RangeType: 0,
        StartRange: 0,
        EndRange: 0
      }
    });

    const playerStats: FreeNBAPlayerStat[] = [];
    const resultSets = response.data?.resultSets || [];

    // Find PlayerStats result set
    const playerStatsData = resultSets.find((rs: any) => rs.name === 'PlayerStats');

    if (!playerStatsData) {
      console.warn(`  ⚠️  No player stats found for game ${gameId}`);
      return [];
    }

    const headers = playerStatsData.headers;
    const rows = playerStatsData.rowSet;

    // Map headers to indices
    const getIndex = (header: string) => headers.indexOf(header);
    const playerIdIdx = getIndex('PLAYER_ID');
    const playerNameIdx = getIndex('PLAYER_NAME');
    const teamIdIdx = getIndex('TEAM_ID');
    const teamAbbrIdx = getIndex('TEAM_ABBREVIATION');
    const minIdx = getIndex('MIN');
    const ptsIdx = getIndex('PTS');
    const rebIdx = getIndex('REB');
    const astIdx = getIndex('AST');

    for (const row of rows) {
      const minutes = parseMinutes(row[minIdx]);

      // Skip players who didn't play
      if (minutes === 0) continue;

      playerStats.push({
        playerId: row[playerIdIdx],
        playerName: row[playerNameIdx],
        teamId: row[teamIdIdx],
        teamAbbr: row[teamAbbrIdx],
        gameId: gameId,
        minutes: minutes,
        points: row[ptsIdx] || 0,
        rebounds: row[rebIdx] || 0,
        assists: row[astIdx] || 0
      });
    }

    console.log(`  ✓ Found ${playerStats.length} player stats for game ${gameId}`);
    return playerStats;

  } catch (error) {
    console.error(`  ✗ Error fetching player stats for game ${gameId}:`, error);
    throw error;
  }
}

/**
 * Parse minutes string to number
 * @param minStr - Minutes string (e.g., "35:20" or "35")
 * @returns Minutes as integer
 */
function parseMinutes(minStr: string | number | null): number {
  if (!minStr) return 0;

  if (typeof minStr === 'number') return Math.floor(minStr);

  if (typeof minStr === 'string') {
    // Handle "MM:SS" format
    if (minStr.includes(':')) {
      const parts = minStr.split(':');
      return parseInt(parts[0]) || 0;
    }
    // Handle decimal format
    return Math.floor(parseFloat(minStr)) || 0;
  }

  return 0;
}

/**
 * Get games for a date range
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of all games in range
 */
export async function fetchScheduleForDateRange(
  startDate: string,
  endDate: string
): Promise<FreeNBAGame[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const allGames: FreeNBAGame[] = [];

  let currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    try {
      const games = await fetchScheduleForDate(dateStr);
      allGames.push(...games);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching ${dateStr}:`, error);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`\n✓ Total games found: ${allGames.length}`);
  return allGames;
}

/**
 * Get today's date in IST timezone
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayIST(): string {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split('T')[0];
}

/**
 * Get yesterday's date in IST timezone
 * @returns Date string in YYYY-MM-DD format
 */
export function getYesterdayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setDate(istTime.getDate() - 1);
  return istTime.toISOString().split('T')[0];
}
