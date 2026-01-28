/**
 * Predictions API Routes
 *
 * Endpoints:
 * - GET /api/predictions/:matchId - Get predictions for a match
 */

import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { generatePrediction } from '../services/prediction/predictionEngine';
import { GameStat } from '../types';

const router = Router();

/**
 * GET /api/predictions/:matchId
 * Get predictions for a specific match
 *
 * PRD Rules:
 * - Only show predictions if match is within 24 hours
 * - Otherwise show: "Predictions coming soon. We are working on updated data."
 * - If player is OUT, show "Not Expected to Play"
 *
 * Response:
 * {
 *   "success": true,
 *   "predictionsAvailable": true,
 *   "data": [
 *     {
 *       "playerId": 1,
 *       "playerName": "LeBron James",
 *       "team": "LAL",
 *       "status": "active",
 *       "points": 25,
 *       "rebounds": 8,
 *       "assists": 8,
 *       "gamesAnalyzed": 15
 *     }
 *   ]
 * }
 */
router.get('/:matchId', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);

    if (isNaN(matchId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid match ID'
      });
    }

    // Get match information
    const matchResult = await pool.query(
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
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    const match = matchResult.rows[0];

    // Check if match is within 24 hours (PRD requirement)
    // Both times are in UTC, so no timezone conversion needed for comparison
    const gameTime = new Date(match.game_time);
    const now = new Date();
    const hoursDiff = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Show predictions only if game is within 24 hours AND in future
    if (hoursDiff <= 0) {
      // Game has already started or finished
      return res.json({
        success: true,
        predictionsAvailable: false,
        message: 'Game has already started',
        gameTime: match.game_time
      });
    } else if (hoursDiff > 24) {
      // Game is more than 24 hours away
      return res.json({
        success: true,
        predictionsAvailable: false,
        message: 'Predictions coming soon. We are working on updated data.',
        gameTime: match.game_time
      });
    }

    // Game is within 24 hours - continue to generate/show predictions

    // Get predictions from database (if already generated)
    const predictionsResult = await pool.query(
      `SELECT
         p.id,
         p.player_id as "playerId",
         pl.first_name || ' ' || pl.last_name as "playerName",
         t.abbreviation as team,
         p.points_threshold as points,
         p.rebounds_threshold as rebounds,
         p.assists_threshold as assists,
         p.games_analyzed as "gamesAnalyzed",
         COALESCE(ps.status, 'active') as status
       FROM predictions p
       JOIN players pl ON p.player_id = pl.id
       JOIN teams t ON pl.current_team_id = t.id
       LEFT JOIN player_status ps ON ps.player_id = p.player_id AND ps.match_id = p.match_id
       WHERE p.match_id = $1
       ORDER BY p.points_threshold DESC NULLS LAST`,
      [matchId]
    );

    // If predictions exist, return them
    if (predictionsResult.rows.length > 0) {
      return res.json({
        success: true,
        predictionsAvailable: true,
        count: predictionsResult.rows.length,
        data: predictionsResult.rows
      });
    }

    // If no predictions in database, generate them on-the-fly
    // Get all players from both teams
    const playersResult = await pool.query(
      `SELECT DISTINCT p.id, p.first_name, p.last_name, t.abbreviation as team
       FROM players p
       JOIN teams t ON p.current_team_id = t.id
       WHERE t.id = $1 OR t.id = $2`,
      [match.home_team_id, match.away_team_id]
    );

    if (playersResult.rows.length === 0) {
      return res.json({
        success: true,
        predictionsAvailable: false,
        message: 'No player data available yet',
        data: []
      });
    }

    // Generate predictions for each player
    const predictions = [];

    for (const player of playersResult.rows) {
      try {
        // Get player's last 15 games
        const statsResult = await pool.query(
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
          continue; // Skip players without enough data
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

        // Add to results
        predictions.push({
          playerId: player.id,
          playerName: `${player.first_name} ${player.last_name}`,
          team: player.team,
          status: 'active',
          points: prediction.pointsThreshold,
          rebounds: prediction.reboundsThreshold,
          assists: prediction.assistsThreshold,
          gamesAnalyzed: prediction.gamesAnalyzed
        });

      } catch (error) {
        console.error(`Error generating prediction for player ${player.id}:`, error);
        // Skip this player and continue
      }
    }

    res.json({
      success: true,
      predictionsAvailable: true,
      count: predictions.length,
      data: predictions
    });

  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predictions',
      message: (error as Error).message
    });
  }
});

export default router;
