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

export default router;
