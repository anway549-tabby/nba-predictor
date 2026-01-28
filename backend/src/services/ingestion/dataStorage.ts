/**
 * Data Storage Functions
 *
 * Handles saving NBA data to PostgreSQL database
 * Uses upsert (INSERT ... ON CONFLICT) to handle duplicates
 */

import pool from '../../config/database';
import { NBAGame, NBAPlayerStats, parseMinutes } from './nbaApiClient';

/**
 * Save team to database (upsert)
 * @param teamId - NBA team ID
 * @param name - Team full name
 * @param abbreviation - Team abbreviation (e.g., "LAL")
 * @returns Database team ID
 */
export async function saveTeam(
  teamId: number,
  name: string,
  abbreviation: string
): Promise<number> {
  try {
    const result = await pool.query(
      `INSERT INTO teams (nba_team_id, name, abbreviation)
       VALUES ($1, $2, $3)
       ON CONFLICT (nba_team_id)
       DO UPDATE SET name = $2, abbreviation = $3
       RETURNING id`,
      [teamId, name, abbreviation]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error(`Error saving team ${abbreviation}:`, error);
    throw error;
  }
}

/**
 * Save player to database (upsert)
 * @param playerId - NBA player ID
 * @param firstName - Player first name
 * @param lastName - Player last name
 * @param teamId - Database team ID
 * @returns Database player ID
 */
export async function savePlayer(
  playerId: number,
  firstName: string,
  lastName: string,
  teamId: number
): Promise<number> {
  try {
    const result = await pool.query(
      `INSERT INTO players (nba_player_id, first_name, last_name, current_team_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (nba_player_id)
       DO UPDATE SET
         first_name = $2,
         last_name = $3,
         current_team_id = $4
       RETURNING id`,
      [playerId, firstName, lastName, teamId]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error(`Error saving player ${firstName} ${lastName}:`, error);
    throw error;
  }
}

/**
 * Save match to database (upsert)
 * @param game - NBA game data
 * @returns Database match ID
 */
export async function saveMatch(game: NBAGame): Promise<number> {
  try {
    // Save home and away teams first
    const homeTeamId = await saveTeam(
      game.home_team.id,
      game.home_team.full_name,
      game.home_team.abbreviation
    );

    const awayTeamId = await saveTeam(
      game.visitor_team.id,
      game.visitor_team.full_name,
      game.visitor_team.abbreviation
    );

    // Determine match status
    let status = 'scheduled';
    if (game.status === 'Final') {
      status = 'completed';
    } else if (game.status && game.status.includes('Q')) {
      status = 'in_progress';
    }

    // Save match
    const result = await pool.query(
      `INSERT INTO matches (
         nba_game_id,
         game_date,
         game_time,
         home_team_id,
         away_team_id,
         season,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (nba_game_id)
       DO UPDATE SET status = $7
       RETURNING id`,
      [
        game.id.toString(),
        game.date,
        game.date, // Use date as time for now (can be enhanced later)
        homeTeamId,
        awayTeamId,
        '2024-25', // Current NBA season
        status
      ]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error(`Error saving match ${game.id}:`, error);
    throw error;
  }
}

/**
 * Save player game stats (upsert)
 * @param stat - Player stats from NBA API
 * @param matchId - Database match ID
 */
export async function savePlayerGameStats(
  stat: NBAPlayerStats,
  matchId: number
): Promise<void> {
  try {
    // Save team and player first
    const teamId = await saveTeam(
      stat.team.id,
      stat.team.full_name,
      stat.team.abbreviation
    );

    const playerId = await savePlayer(
      stat.player.id,
      stat.player.first_name,
      stat.player.last_name,
      teamId
    );

    // Parse minutes played
    const minutes = parseMinutes(stat.min);

    // Get opponent team ID (the team the player's team played against)
    const matchResult = await pool.query(
      `SELECT home_team_id, away_team_id FROM matches WHERE id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      console.warn(`Match ${matchId} not found when saving player stats`);
      return;
    }

    const match = matchResult.rows[0];
    const opponentTeamId = match.home_team_id === teamId
      ? match.away_team_id
      : match.home_team_id;

    // Save player game stats
    await pool.query(
      `INSERT INTO player_game_stats (
         player_id,
         match_id,
         team_id,
         game_date,
         opponent_team_id,
         minutes_played,
         points,
         rebounds,
         assists,
         is_imputed
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       ON CONFLICT (player_id, match_id)
       DO UPDATE SET
         minutes_played = $6,
         points = $7,
         rebounds = $8,
         assists = $9`,
      [
        playerId,
        matchId,
        teamId,
        stat.game.date,
        opponentTeamId,
        minutes,
        stat.pts || 0,
        stat.reb || 0,
        stat.ast || 0
      ]
    );
  } catch (error) {
    console.error(`Error saving player game stats:`, error);
    throw error;
  }
}

/**
 * Log data refresh job
 * @param date - Date of refresh
 * @param status - Status (success, partial, failed)
 * @param gamesFetched - Number of games fetched
 * @param statsFetched - Number of player stats fetched
 * @param errorMessage - Error message if failed
 */
export async function logDataRefresh(
  date: string,
  status: 'success' | 'partial' | 'failed',
  gamesFetched: number = 0,
  statsFetched: number = 0,
  errorMessage?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO data_refresh_log (
         refresh_date,
         status,
         games_fetched,
         stats_fetched,
         error_message
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [date, status, gamesFetched, statsFetched, errorMessage || null]
    );
  } catch (error) {
    console.error('Error logging data refresh:', error);
  }
}
