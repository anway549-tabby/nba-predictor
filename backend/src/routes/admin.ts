/**
 * Admin Routes
 * Internal administrative endpoints
 */

import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../config/database';
import { generatePredictionsForMatch } from '../services/prediction/predictionService';

const router = Router();

/**
 * POST /api/admin/migrate
 * Run database migration (creates all tables)
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Starting database migration...');

    // Read the schema file
    const schemaPath = join(__dirname, '../db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute the schema
    await pool.query(schema);

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = result.rows.map(row => row.table_name);

    console.log('✅ Migration completed successfully!');
    console.log('Created tables:', tables);

    res.json({
      success: true,
      message: 'Database migration completed successfully',
      tables
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/generate-predictions
 * Generate predictions for all scheduled matches within 36 hours
 */
router.post('/generate-predictions', async (req: Request, res: Response) => {
  try {
    console.log('🔮 Generating predictions for scheduled matches...');

    const now = new Date();
    const threshold = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    // Get all scheduled matches within 36 hours
    const matchesResult = await pool.query(`
      SELECT m.id, m.game_time,
             ht.abbreviation as home,
             at.abbreviation as away
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.status = 'scheduled'
        AND m.game_time <= $1
        AND m.game_time > $2
      ORDER BY m.game_time
    `, [threshold, now]);

    console.log(`Found ${matchesResult.rows.length} scheduled matches`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const match of matchesResult.rows) {
      try {
        const predictions = await generatePredictionsForMatch(match.id);
        results.push({
          matchId: match.id,
          match: `${match.away} @ ${match.home}`,
          predictionsGenerated: predictions.length
        });
        successCount++;
      } catch (error) {
        results.push({
          matchId: match.id,
          match: `${match.away} @ ${match.home}`,
          error: (error as Error).message
        });
        errorCount++;
      }
    }

    console.log(`✅ Prediction generation completed!`);
    console.log(`   Success: ${successCount}, Errors: ${errorCount}`);

    res.json({
      success: true,
      message: 'Prediction generation completed',
      matchesProcessed: matchesResult.rows.length,
      successCount,
      errorCount,
      results
    });

  } catch (error) {
    console.error('❌ Prediction generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Prediction generation failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/refresh-times
 * Refresh game times from ESPN for all scheduled matches
 */
router.post('/refresh-times', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Refreshing schedule times from ESPN...');

    // Dynamic import
    const { fetchESPNScoreboard, convertESPNGame } = require('../services/ingestion/espnApiClient');

    // Get all scheduled matches
    const scheduled = await pool.query(`
      SELECT id, nba_game_id, game_date, game_time
      FROM matches
      WHERE status = 'scheduled'
      ORDER BY game_date
    `);

    console.log(`Found ${scheduled.rows.length} scheduled matches`);

    // Group by date
    const dateMap = new Map<string, any[]>();
    for (const match of scheduled.rows) {
      const date = match.game_date.toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(match);
    }

    let updated = 0;
    let unchanged = 0;
    const updates = [];

    // Process each date
    for (const [date, matches] of dateMap.entries()) {
      try {
        const espnGames = await fetchESPNScoreboard(date);

        for (const match of matches) {
          const espnGame = espnGames.find((g: any) => g.id === match.nba_game_id);

          if (espnGame) {
            const converted = convertESPNGame(espnGame);
            const oldTime = new Date(match.game_time);
            const newTime = new Date(converted.gameTime);

            if (oldTime.getTime() !== newTime.getTime()) {
              await pool.query(
                'UPDATE matches SET game_time = $1, game_date = $2 WHERE id = $3',
                [newTime, new Date(converted.gameDate), match.id]
              );

              updates.push({
                matchId: match.id,
                oldTime: oldTime.toISOString(),
                newTime: newTime.toISOString()
              });

              updated++;
            } else {
              unchanged++;
            }
          }
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        console.error(`Error processing date ${date}:`, error);
      }
    }

    console.log(`✅ Refresh complete: ${updated} updated, ${unchanged} unchanged`);

    res.json({
      success: true,
      message: 'Schedule times refreshed from ESPN',
      updated,
      unchanged,
      total: scheduled.rows.length,
      updates: updates.slice(0, 10) // Show first 10 updates
    });

  } catch (error) {
    console.error('❌ Refresh failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh times',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/fix-times
 * Fix incorrect times by subtracting 5.5 hours from all scheduled matches
 */
router.post('/fix-times', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Fixing incorrect schedule times...');

    // Get all scheduled matches with incorrect times
    const result = await pool.query(`
      UPDATE matches
      SET game_time = game_time - INTERVAL '5.5 hours',
          game_date = (game_time - INTERVAL '5.5 hours')::date
      WHERE status = 'scheduled'
      RETURNING id, nba_game_id, game_time
    `);

    console.log(`✅ Fixed ${result.rows.length} matches`);

    res.json({
      success: true,
      message: `Fixed ${result.rows.length} scheduled match times`,
      updated: result.rows.length,
      sample: result.rows.slice(0, 5).map(r => ({
        id: r.id,
        gameId: r.nba_game_id,
        newTime: r.game_time
      }))
    });

  } catch (error) {
    console.error('❌ Fix failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix times',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/admin/debug-match/:matchId
 * Debug why predictions aren't generating for a match
 */
router.get('/debug-match/:matchId', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);

    // Get match info
    const match = await pool.query(`
      SELECT m.id, m.home_team_id, m.away_team_id,
             ht.name as home_name, ht.abbreviation as home,
             at.name as away_name, at.abbreviation as away
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.id = $1
    `, [matchId]);

    if (match.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const m = match.rows[0];

    // Check players for both teams
    const homePlayers = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE current_team_id = $1',
      [m.home_team_id]
    );

    const awayPlayers = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE current_team_id = $1',
      [m.away_team_id]
    );

    // Check eligible players (15+ games)
    const eligible = await pool.query(`
      SELECT p.id, p.first_name || ' ' || p.last_name as name,
             t.abbreviation, COUNT(pgs.id) as games
      FROM players p
      JOIN teams t ON p.current_team_id = t.id
      LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
      WHERE t.id IN ($1, $2)
      GROUP BY p.id, p.first_name, p.last_name, t.abbreviation
      HAVING COUNT(pgs.id) >= 15
      ORDER BY games DESC
      LIMIT 10
    `, [m.home_team_id, m.away_team_id]);

    res.json({
      success: true,
      match: {
        id: m.id,
        matchup: `${m.away} @ ${m.home}`,
        homeTeam: { id: m.home_team_id, name: m.home_name, abbreviation: m.home },
        awayTeam: { id: m.away_team_id, name: m.away_name, abbreviation: m.away }
      },
      playerCounts: {
        home: parseInt(homePlayers.rows[0].count),
        away: parseInt(awayPlayers.rows[0].count),
        eligibleTotal: eligible.rows.length
      },
      sampleEligiblePlayers: eligible.rows
    });

  } catch (error) {
    console.error('Debug failed:', error);
    res.status(500).json({
      success: false,
      error: 'Debug failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/run-daily-refresh
 * Manually trigger the daily refresh job
 */
router.post('/run-daily-refresh', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Manually triggering daily refresh...');

    // Dynamic import to avoid loading at startup
    const { runDailyRefreshESPN } = require('../services/ingestion/dailyRefreshESPN');

    // Run in background but don't wait for completion
    runDailyRefreshESPN()
      .then(() => {
        console.log('✅ Daily refresh completed successfully');
      })
      .catch((error: Error) => {
        console.error('❌ Daily refresh failed:', error);
      });

    // Return immediately
    res.json({
      success: true,
      message: 'Daily refresh job started in background. Check logs for progress.'
    });

  } catch (error) {
    console.error('❌ Failed to start refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start daily refresh',
      message: (error as Error).message
    });
  }
});

export default router;
