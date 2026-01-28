/**
 * Data Storage for Free NBA Client
 *
 * Saves games and player stats from free NBA.com API to database
 */

import pool from '../../config/database';
import { FreeNBAGame, FreeNBAPlayerStat } from './freeNbaClient';

/**
 * Save a game to the database
 * @param game - Free NBA game data
 * @returns Database match ID
 */
export async function saveFreeGame(game: FreeNBAGame): Promise<number> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure teams exist in database
    const homeTeamDbId = await ensureTeamExists(
      client,
      game.homeTeam.teamId,
      game.homeTeam.abbreviation,
      game.homeTeam.name
    );

    const awayTeamDbId = await ensureTeamExists(
      client,
      game.awayTeam.teamId,
      game.awayTeam.abbreviation,
      game.awayTeam.name
    );

    // 2. Check if match already exists
    const existingMatch = await client.query(
      'SELECT id FROM matches WHERE nba_game_id = $1',
      [game.gameId]
    );

    let matchId: number;

    if (existingMatch.rows.length > 0) {
      // Update existing match
      matchId = existingMatch.rows[0].id;

      await client.query(
        `UPDATE matches
         SET game_date = $1,
             game_time = $2,
             status = $3,
             home_team_score = $4,
             away_team_score = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
          game.gameDate,
          game.gameTime,
          game.status,
          game.homeTeam.score || null,
          game.awayTeam.score || null,
          matchId
        ]
      );
    } else {
      // Insert new match
      const result = await client.query(
        `INSERT INTO matches (
           nba_game_id, game_date, game_time, status, season,
           home_team_id, away_team_id, home_team_score, away_team_score
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          game.gameId,
          game.gameDate,
          game.gameTime,
          game.status,
          '2025-26', // Current season
          homeTeamDbId,
          awayTeamDbId,
          game.homeTeam.score || null,
          game.awayTeam.score || null
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
 * Save player game stats to database
 * @param stat - Free NBA player stat
 * @param matchId - Database match ID
 */
export async function saveFreePlayerStat(
  stat: FreeNBAPlayerStat,
  matchId: number
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure player exists in database
    const playerDbId = await ensurePlayerExists(
      client,
      stat.playerId,
      stat.playerName,
      stat.teamId
    );

    // 2. Check if stat already exists
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
             assists = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [stat.minutes, stat.points, stat.rebounds, stat.assists, existingStat.rows[0].id]
      );
    } else {
      // Insert new stat
      await client.query(
        `INSERT INTO player_game_stats (
           player_id, match_id, minutes_played, points, rebounds, assists
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [playerDbId, matchId, stat.minutes, stat.points, stat.rebounds, stat.assists]
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
 * Ensure team exists in database
 * @returns Database team ID
 */
async function ensureTeamExists(
  client: any,
  nbaTeamId: number,
  abbreviation: string,
  name: string
): Promise<number> {
  const existing = await client.query(
    'SELECT id FROM teams WHERE nba_team_id = $1',
    [nbaTeamId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const result = await client.query(
    `INSERT INTO teams (nba_team_id, abbreviation, name, conference, division)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nbaTeamId, abbreviation, name, 'Unknown', 'Unknown']
  );

  return result.rows[0].id;
}

/**
 * Ensure player exists in database
 * @returns Database player ID
 */
async function ensurePlayerExists(
  client: any,
  nbaPlayerId: number,
  fullName: string,
  currentTeamId: number
): Promise<number> {
  const existing = await client.query(
    'SELECT id FROM players WHERE nba_player_id = $1',
    [nbaPlayerId]
  );

  if (existing.rows.length > 0) {
    // Update current team
    const teamDbId = await client.query(
      'SELECT id FROM teams WHERE nba_team_id = $1',
      [currentTeamId]
    );

    if (teamDbId.rows.length > 0) {
      await client.query(
        'UPDATE players SET current_team_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [teamDbId.rows[0].id, existing.rows[0].id]
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
    'SELECT id FROM teams WHERE nba_team_id = $1',
    [currentTeamId]
  );

  const teamDbId = teamDbIdResult.rows.length > 0 ? teamDbIdResult.rows[0].id : null;

  const result = await client.query(
    `INSERT INTO players (
       nba_player_id, first_name, last_name, position, current_team_id
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nbaPlayerId, firstName, lastName, 'Unknown', teamDbId]
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
