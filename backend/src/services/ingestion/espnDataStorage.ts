/**
 * Data Storage for ESPN API
 *
 * Saves games and player stats from ESPN public API to database
 */

import pool from '../../config/database';

/**
 * The 30 official NBA team abbreviations.
 * Any game/team outside this set is treated as exhibition/All-Star and skipped.
 */
const NBA_TEAM_ABBREVIATIONS = new Set([
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GS',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NO', 'NY',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SA', 'SAC', 'TOR', 'UTAH', 'WSH'
]);

export function isNBATeam(abbreviation: string): boolean {
  return NBA_TEAM_ABBREVIATIONS.has(abbreviation.toUpperCase());
}

/**
 * ESPN Game format (converted)
 */
interface ESPNGameConverted {
  gameId: string;
  gameDate: string;
  gameTime: string;
  status: string;
  // ESPN season.type (1 preseason / 2 regular / 3 postseason) and slug.
  // Optional so older callers still compile; null persists as "unknown",
  // which every predictability filter treats as not predictable.
  seasonType?: number | null;
  seasonSlug?: string | null;
  homeTeam: { id: string; abbreviation: string; name: string; score?: number };
  awayTeam: { id: string; abbreviation: string; name: string; score?: number };
}

/**
 * Season label ("2026-27") for a game, derived from its date.
 *
 * An NBA season spans two calendar years and always starts in the autumn, so
 * games in Jan-Jun belong to the season that began the previous year. This
 * replaces a hardcoded '2025-26' that mislabelled every game after Jun 2026.
 */
function seasonLabelForDate(gameDate: string): string {
  const d = new Date(gameDate);
  const year = d.getUTCFullYear();
  // July is the earliest a new season's fixtures appear; Jan-Jun is the tail
  // of the season that started the previous calendar year.
  const startYear = d.getUTCMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * ESPN Player Stats format
 */
interface ESPNPlayerStatsConverted {
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
 * Save ESPN game to database
 * @param game - ESPN game data (converted format)
 * @returns Database match ID
 */
export async function saveESPNGame(game: ESPNGameConverted): Promise<number> {
  // Skip All-Star / exhibition games — they corrupt player team assignments
  if (!isNBATeam(game.homeTeam.abbreviation) || !isNBATeam(game.awayTeam.abbreviation)) {
    console.log(`  ⏭️  Skipping non-NBA game: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
    return -1;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure teams exist in database
    const homeTeamDbId = await ensureESPNTeamExists(
      client,
      game.homeTeam.id,
      game.homeTeam.abbreviation,
      game.homeTeam.name
    );

    const awayTeamDbId = await ensureESPNTeamExists(
      client,
      game.awayTeam.id,
      game.awayTeam.abbreviation,
      game.awayTeam.name
    );

    // 2. Check if match already exists (using ESPN game ID)
    const existingMatch = await client.query(
      'SELECT id FROM matches WHERE nba_game_id = $1',
      [game.gameId]
    );

    let matchId: number;

    if (existingMatch.rows.length > 0) {
      // Update existing match
      matchId = existingMatch.rows[0].id;

      // COALESCE so a payload that omits season info never erases a value we
      // already backfilled for this match.
      await client.query(
        `UPDATE matches
         SET game_date = $1,
             game_time = $2,
             status = $3,
             season = $4,
             season_type = COALESCE($5, season_type),
             season_slug = COALESCE($6, season_slug)
         WHERE id = $7`,
        [
          new Date(game.gameDate),
          new Date(game.gameTime),
          game.status,
          seasonLabelForDate(game.gameDate),
          game.seasonType ?? null,
          game.seasonSlug ?? null,
          matchId
        ]
      );
    } else {
      // Insert new match
      const result = await client.query(
        `INSERT INTO matches (
           nba_game_id, game_date, game_time, status, season,
           season_type, season_slug, home_team_id, away_team_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          game.gameId,
          new Date(game.gameDate),
          new Date(game.gameTime),
          game.status,
          seasonLabelForDate(game.gameDate),
          game.seasonType ?? null,
          game.seasonSlug ?? null,
          homeTeamDbId,
          awayTeamDbId
        ]
      );

      matchId = result.rows[0].id;
    }

    await client.query('COMMIT');
    return matchId;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Save ESPN player game stats to database
 * @param stat - ESPN player stat
 * @param matchId - Database match ID
 */
export async function saveESPNPlayerStat(
  stat: ESPNPlayerStatsConverted,
  matchId: number
): Promise<void> {
  // matchId of -1 means the game was skipped (All-Star/exhibition)
  if (matchId === -1) return;

  // Skip stats for non-NBA teams
  if (!isNBATeam(stat.teamAbbr)) return;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure player exists in database
    const playerDbId = await ensureESPNPlayerExists(
      client,
      stat.playerId,
      stat.playerName,
      stat.teamId
    );

    // 2. Get team DB ID
    const teamResult = await client.query(
      'SELECT id FROM teams WHERE nba_team_id::text = $1',
      [stat.teamId]
    );

    if (teamResult.rows.length === 0) {
      console.warn(`  ⚠️  Team not found: ${stat.teamAbbr}`);
      await client.query('ROLLBACK');
      return;
    }

    const teamDbId = teamResult.rows[0].id;

    // 3. Get match date
    const matchResult = await client.query(
      'SELECT game_date, away_team_id, home_team_id FROM matches WHERE id = $1',
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    const gameDate = matchResult.rows[0].game_date;
    const awayTeamId = matchResult.rows[0].away_team_id;
    const homeTeamId = matchResult.rows[0].home_team_id;

    // Determine opponent team
    const opponentTeamId = teamDbId === homeTeamId ? awayTeamId : homeTeamId;

    // 4. Check if stat already exists
    const existingStat = await client.query(
      'SELECT id FROM player_game_stats WHERE player_id = $1 AND match_id = $2',
      [playerDbId, matchId]
    );

    if (existingStat.rows.length > 0) {
      // Update existing stat
      await client.query(
        `UPDATE player_game_stats
         SET minutes_played = $1,
             points = $2,
             rebounds = $3,
             assists = $4
         WHERE id = $5`,
        [stat.minutes, stat.points, stat.rebounds, stat.assists, existingStat.rows[0].id]
      );
    } else {
      // Insert new stat
      await client.query(
        `INSERT INTO player_game_stats (
           player_id, match_id, team_id, game_date, opponent_team_id,
           minutes_played, points, rebounds, assists
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [playerDbId, matchId, teamDbId, gameDate, opponentTeamId, stat.minutes, stat.points, stat.rebounds, stat.assists]
      );
    }

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ensure ESPN team exists in database
 * @returns Database team ID
 */
async function ensureESPNTeamExists(
  client: any,
  espnTeamId: string,
  abbreviation: string,
  name: string
): Promise<number> {
  // Convert ESPN team ID to integer for storage
  const teamIdInt = parseInt(espnTeamId);

  // First check by abbreviation to avoid duplicates (ESPN team IDs can vary)
  const existingByAbbr = await client.query(
    'SELECT id, nba_team_id FROM teams WHERE abbreviation = $1 LIMIT 1',
    [abbreviation]
  );

  if (existingByAbbr.rows.length > 0) {
    // Update the ESPN team ID if it's different (ESPN IDs can change)
    const existingId = existingByAbbr.rows[0].id;
    const existingNbaId = existingByAbbr.rows[0].nba_team_id;

    if (existingNbaId !== teamIdInt) {
      await client.query(
        'UPDATE teams SET nba_team_id = $1 WHERE id = $2',
        [teamIdInt, existingId]
      );
    }

    return existingId;
  }

  // Check by nba_team_id as fallback
  const existingById = await client.query(
    'SELECT id FROM teams WHERE nba_team_id = $1 LIMIT 1',
    [teamIdInt]
  );

  if (existingById.rows.length > 0) {
    // Team exists with this ID but different abbreviation - update abbreviation
    const existingId = existingById.rows[0].id;
    await client.query(
      'UPDATE teams SET abbreviation = $1, name = $2 WHERE id = $3',
      [abbreviation, name, existingId]
    );
    return existingId;
  }

  // Team doesn't exist - insert new
  const result = await client.query(
    `INSERT INTO teams (nba_team_id, abbreviation, name)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [teamIdInt, abbreviation, name]
  );

  return result.rows[0].id;
}

/**
 * Ensure ESPN player exists in database
 * @returns Database player ID
 */
async function ensureESPNPlayerExists(
  client: any,
  espnPlayerId: string,
  fullName: string,
  currentTeamId: string
): Promise<number> {
  // Convert ESPN player ID to integer
  const playerIdInt = parseInt(espnPlayerId);

  const existing = await client.query(
    'SELECT id FROM players WHERE nba_player_id = $1',
    [playerIdInt]
  );

  if (existing.rows.length > 0) {
    // Update current team only if it's a real NBA team (not All-Star/exhibition)
    const teamDbIdResult = await client.query(
      `SELECT t.id, t.abbreviation FROM teams t WHERE t.nba_team_id::text = $1`,
      [currentTeamId]
    );

    if (teamDbIdResult.rows.length > 0 && isNBATeam(teamDbIdResult.rows[0].abbreviation)) {
      await client.query(
        'UPDATE players SET current_team_id = $1 WHERE id = $2',
        [teamDbIdResult.rows[0].id, existing.rows[0].id]
      );
    }

    return existing.rows[0].id;
  }

  // Parse name (assuming "FirstName LastName" format)
  const nameParts = fullName.trim().split(' ');
  const lastName = nameParts.pop() || '';
  const firstName = nameParts.join(' ') || '';

  // Get team DB ID
  const teamDbIdResult = await client.query(
    'SELECT id FROM teams WHERE nba_team_id::text = $1',
    [currentTeamId]
  );

  const teamDbId = teamDbIdResult.rows.length > 0 ? teamDbIdResult.rows[0].id : null;

  const result = await client.query(
    `INSERT INTO players (
       nba_player_id, first_name, last_name, position, current_team_id
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [playerIdInt, firstName, lastName, 'Unknown', teamDbId]
  );

  return result.rows[0].id;
}

/**
 * Log data refresh operation
 */
export async function logDataRefresh(
  date: string,
  status: 'success' | 'partial' | 'failed',
  gamesProcessed: number,
  statsProcessed: number,
  errorMessage?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO data_refresh_log (refresh_date, status, games_fetched, stats_fetched, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [date, status, gamesProcessed, statsProcessed, errorMessage || null]
    );
  } catch (error) {
    console.error('Error logging data refresh:', error);
  }
}

export type { ESPNGameConverted, ESPNPlayerStatsConverted };
