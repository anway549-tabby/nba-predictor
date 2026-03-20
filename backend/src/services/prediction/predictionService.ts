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
      `SELECT DISTINCT p.id, p.first_name, p.last_name, t.abbreviation as team, p.current_team_id as team_id
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
        // Get team's last 15 completed NBA games (per PRD: use team schedule, not player history)
        // This ensures players who recently joined the team still get predictions,
        // with 0-minute placeholders for games before they arrived.
        const teamGamesResult = await client.query(
          `SELECT
             m.id as match_id,
             m.game_date,
             CASE WHEN m.home_team_id = $1 THEN m.away_team_id ELSE m.home_team_id END as opponent_team_id
           FROM matches m
           JOIN teams ht ON m.home_team_id = ht.id
           JOIN teams at ON m.away_team_id = at.id
           WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
             AND m.status = 'final'
             AND ht.abbreviation IN ('ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GS',
                                     'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NO','NY',
                                     'OKC','ORL','PHI','PHX','POR','SA','SAC','TOR','UTAH','WSH')
             AND at.abbreviation IN ('ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GS',
                                     'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NO','NY',
                                     'OKC','ORL','PHI','PHX','POR','SA','SAC','TOR','UTAH','WSH')
           ORDER BY m.game_date DESC
           LIMIT 15`,
          [player.team_id]
        );

        if (teamGamesResult.rows.length < 15) {
          console.log(`  ⏩ Skipping ${player.first_name} ${player.last_name} - team only has ${teamGamesResult.rows.length} recorded games`);
          continue;
        }

        // For each team game, fetch player's stats or use 0-minute placeholder
        const last15Games: GameStat[] = await Promise.all(
          teamGamesResult.rows.map(async (teamGame: any) => {
            const statRow = await client.query(
              `SELECT
                 pgs.minutes_played as minutes,
                 pgs.points,
                 pgs.rebounds,
                 pgs.assists,
                 t.abbreviation as opponent
               FROM player_game_stats pgs
               JOIN teams t ON pgs.opponent_team_id = t.id
               WHERE pgs.player_id = $1 AND pgs.match_id = $2`,
              [player.id, teamGame.match_id]
            );

            if (statRow.rows.length > 0) {
              const r = statRow.rows[0];
              return {
                date: teamGame.game_date,
                opponent: r.opponent,
                minutes: r.minutes,
                points: r.points,
                rebounds: r.rebounds,
                assists: r.assists,
                isImputed: false
              };
            }

            // Player wasn't on the team / didn't play — treat as 0-minute game
            const opponentResult = await client.query(
              'SELECT abbreviation FROM teams WHERE id = $1',
              [teamGame.opponent_team_id]
            );
            return {
              date: teamGame.game_date,
              opponent: opponentResult.rows[0]?.abbreviation ?? 'UNK',
              minutes: 0,
              points: 0,
              rebounds: 0,
              assists: 0,
              isImputed: false
            };
          })
        );

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
