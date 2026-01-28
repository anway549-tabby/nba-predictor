/**
 * Players API Routes
 *
 * Endpoints:
 * - GET /api/players/:playerId/stats - Get player's last 15 games
 */

import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

/**
 * GET /api/players/search?query={playerName}
 * Search for players by name
 *
 * Query Parameters:
 * - query: Search string (minimum 2 characters)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "nbaPlayerId": 237,
 *       "firstName": "LeBron",
 *       "lastName": "James",
 *       "name": "LeBron James",
 *       "position": "F",
 *       "team": "LAL",
 *       "teamName": "Los Angeles Lakers"
 *     }
 *   ]
 * }
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.query as string) || '';

    if (query.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const result = await pool.query(
      `SELECT
         p.id,
         p.nba_player_id as "nbaPlayerId",
         p.first_name as "firstName",
         p.last_name as "lastName",
         p.first_name || ' ' || p.last_name as name,
         p.position,
         t.abbreviation as team,
         t.name as "teamName"
       FROM players p
       LEFT JOIN teams t ON p.current_team_id = t.id
       WHERE LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
       ORDER BY p.last_name, p.first_name
       LIMIT 20`,
      [`%${query}%`]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error searching players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search players',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/players/:playerId/stats
 * Get player's historical stats (last 15 games)
 *
 * Query Parameters:
 * - limit: Number of games to return (default: 15, max: 15)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "player": {
 *       "id": 1,
 *       "name": "LeBron James",
 *       "team": "LAL"
 *     },
 *     "stats": [
 *       {
 *         "date": "2025-01-23",
 *         "opponent": "GSW",
 *         "minutes": 35,
 *         "points": 28,
 *         "rebounds": 8,
 *         "assists": 11,
 *         "isImputed": false
 *       }
 *     ]
 *   }
 * }
 */
router.get('/:playerId/stats', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const limit = Math.min(parseInt(req.query.limit as string) || 15, 15);

    if (isNaN(playerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid player ID'
      });
    }

    // Get player info
    const playerResult = await pool.query(
      `SELECT
         p.id,
         p.first_name as "firstName",
         p.last_name as "lastName",
         p.first_name || ' ' || p.last_name as name,
         p.position,
         t.abbreviation as team
       FROM players p
       LEFT JOIN teams t ON p.current_team_id = t.id
       WHERE p.id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }

    const player = playerResult.rows[0];

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
       LIMIT $2`,
      [playerId, limit]
    );

    res.json({
      success: true,
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        name: player.name,
        position: player.position,
        team: player.team
      },
      data: {
        stats: statsResult.rows
      },
      gamesCount: statsResult.rows.length
    });

  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player stats',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/players/:playerId
 * Get player information
 */
router.get('/:playerId', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);

    if (isNaN(playerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid player ID'
      });
    }

    const result = await pool.query(
      `SELECT
         p.id,
         p.nba_player_id as "nbaPlayerId",
         p.first_name as "firstName",
         p.last_name as "lastName",
         p.position,
         json_build_object(
           'id', t.id,
           'name', t.name,
           'abbreviation', t.abbreviation
         ) as team
       FROM players p
       LEFT JOIN teams t ON p.current_team_id = t.id
       WHERE p.id = $1`,
      [playerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player',
      message: (error as Error).message
    });
  }
});

export default router;
