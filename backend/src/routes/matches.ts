/**
 * Matches API Routes
 *
 * Endpoints:
 * - GET /api/matches?date=YYYY-MM-DD - Get matches for a specific date
 */

import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

/**
 * GET /api/matches?date=YYYY-MM-DD
 * Get matches for a specific date
 *
 * Query Parameters:
 * - date: Date in YYYY-MM-DD format (default: today)
 * - status: Filter by status (scheduled, in_progress, completed)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "matchId": "0022400123",
 *       "gameDate": "2025-01-24",
 *       "gameTime": "2025-01-24T19:30:00",
 *       "status": "scheduled",
 *       "homeTeam": { "id": 1, "name": "Los Angeles Lakers", "abbreviation": "LAL" },
 *       "awayTeam": { "id": 2, "name": "Golden State Warriors", "abbreviation": "GSW" }
 *     }
 *   ]
 * }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get date from query params (default to today)
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const status = req.query.status as string | undefined;

    // Build query - convert game_time to IST (UTC +5:30) for date filtering
    let query = `
      SELECT
        m.id,
        m.nba_game_id as "matchId",
        m.game_date as "gameDate",
        m.game_time as "gameTime",
        m.status,
        m.season,
        json_build_object(
          'id', ht.id,
          'name', ht.name,
          'abbreviation', ht.abbreviation
        ) as "homeTeam",
        json_build_object(
          'id', at.id,
          'name', at.name,
          'abbreviation', at.abbreviation
        ) as "awayTeam"
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE DATE(m.game_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = $1
    `;

    const params: any[] = [date];

    // Add status filter if provided
    if (status) {
      query += ` AND m.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY m.game_time`;

    // Execute query
    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch matches',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/matches/:matchId
 * Get specific match details
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

    const result = await pool.query(
      `SELECT
         m.id,
         m.nba_game_id as "matchId",
         m.game_date as "gameDate",
         m.game_time as "gameTime",
         m.status,
         m.season,
         json_build_object(
           'id', ht.id,
           'name', ht.name,
           'abbreviation', ht.abbreviation
         ) as "homeTeam",
         json_build_object(
           'id', at.id,
           'name', at.name,
           'abbreviation', at.abbreviation
         ) as "awayTeam"
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match',
      message: (error as Error).message
    });
  }
});

export default router;
