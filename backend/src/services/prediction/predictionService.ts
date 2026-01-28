/**
 * Prediction Service
 *
 * Database-aware wrapper for prediction engine
 * Generates predictions for all players in a match and saves to database
 */

import pool from '../../config/database';
import { generatePrediction } from './predictionEngine';
import { GameStat } from '../../types';

export interface PlayerPrediction {
  playerId: number;
  playerName: string;
  team: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  gamesAnalyzed: number;
}

/**
 * Generate predictions for all players in a match
 *
 * @param matchId - Database match ID
 * @returns Array of predictions with player details
 */
export async function generatePredictionsForMatch(matchId: number): Promise<PlayerPrediction[]> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get match information
    const matchResult = await client.query(
      `SELECT
         m.id,
         m.game_time,
         m.status,
         m.home_team_id,
         m.away_team_id
       FROM matches m
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      throw new Error(`Match ${matchId} not found`);
    }

    const match = matchResult.rows[0];

    // Get all players from both teams
    const playersResult = await client.query(
      `SELECT DISTINCT p.id, p.first_name, p.last_name, t.abbreviation as team
       FROM players p
       JOIN teams t ON p.current_team_id = t.id
       WHERE t.id = $1 OR t.id = $2`,
      [match.home_team_id, match.away_team_id]
    );

    if (playersResult.rows.length === 0) {
      console.log(`⚠️  No players found for match ${matchId}`);
      await client.query('COMMIT');
      return [];
    }

    // Generate predictions for each player
    const predictions: PlayerPrediction[] = [];

    for (const player of playersResult.rows) {
      try {
        // Get player's last 15 games
        const statsResult = await client.query(
          `SELECT
             pgs.game_date as date,
             t.abbreviation as opponent,
             pgs.minutes_played as minutes,
             pgs.points,
             pgs.rebounds,
             pgs.assists,
             pgs.is_imputed as "isImputed"
           FROM player_game_stats pgs
           JOIN teams t ON pgs.opponent_team_id = t.id
           WHERE pgs.player_id = $1
           ORDER BY pgs.game_date DESC
           LIMIT 15`,
          [player.id]
        );

        // Need exactly 15 games for prediction
        if (statsResult.rows.length < 15) {
          console.log(`  ⏩ Skipping ${player.first_name} ${player.last_name} - only ${statsResult.rows.length} games`);
          continue;
        }

        const last15Games: GameStat[] = statsResult.rows.map((row: any) => ({
          date: row.date,
          opponent: row.opponent,
          minutes: row.minutes,
          points: row.points,
          rebounds: row.rebounds,
          assists: row.assists,
          isImputed: row.isImputed
        }));

        // Generate prediction using prediction engine
        const prediction = generatePrediction({
          playerId: player.id,
          matchId: matchId,
          last15Games
        });

        // Check if prediction already exists
        const existingPred = await client.query(
          'SELECT id FROM predictions WHERE player_id = $1 AND match_id = $2',
          [player.id, matchId]
        );

        if (existingPred.rows.length > 0) {
          // Update existing prediction
          await client.query(
            `UPDATE predictions
             SET points_threshold = $1,
                 rebounds_threshold = $2,
                 assists_threshold = $3,
                 games_analyzed = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE player_id = $5 AND match_id = $6`,
            [
              prediction.pointsThreshold,
              prediction.reboundsThreshold,
              prediction.assistsThreshold,
              prediction.gamesAnalyzed,
              player.id,
              matchId
            ]
          );
        } else {
          // Insert new prediction
          await client.query(
            `INSERT INTO predictions (
               player_id, match_id, points_threshold, rebounds_threshold,
               assists_threshold, games_analyzed
             )
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              player.id,
              matchId,
              prediction.pointsThreshold,
              prediction.reboundsThreshold,
              prediction.assistsThreshold,
              prediction.gamesAnalyzed
            ]
          );
        }

        // Add to results
        predictions.push({
          playerId: player.id,
          playerName: `${player.first_name} ${player.last_name}`,
          team: player.team,
          points: prediction.pointsThreshold,
          rebounds: prediction.reboundsThreshold,
          assists: prediction.assistsThreshold,
          gamesAnalyzed: prediction.gamesAnalyzed
        });

      } catch (error) {
        console.error(`  ❌ Error generating prediction for ${player.first_name} ${player.last_name}:`, error);
        // Continue with other players
      }
    }

    await client.query('COMMIT');
    return predictions;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
