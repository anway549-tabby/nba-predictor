/**
 * Generate Predictions for Scheduled Games
 *
 * Generates predictions for all upcoming games within next 36 hours
 * Uses IST timezone for calculations as per user requirements
 */

import pool from '../../config/database';
import { generatePredictionsForMatch } from '../prediction/predictionService';

interface PredictionGenerationResult {
  matchesProcessed: number;
  predictionsGenerated: number;
  errors: string[];
}

/**
 * Generate predictions for all scheduled games within next 36 hours
 *
 * Uses 36 hours instead of 24 to ensure predictions are available
 * when daily refresh runs at 12:00 Noon IST
 */
export async function generatePredictionsForSchedule(): Promise<PredictionGenerationResult> {
  console.log('\n===========================================');
  console.log('🔮 Generating Predictions for Scheduled Games');
  console.log('===========================================\n');

  const result: PredictionGenerationResult = {
    matchesProcessed: 0,
    predictionsGenerated: 0,
    errors: []
  };

  try {
    // Get current time and threshold (36 hours from now)
    const now = new Date();
    const threshold = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Threshold: ${threshold.toISOString()}`);
    console.log(`Generating predictions for games within next 36 hours\n`);

    // Get all scheduled matches within next 36 hours
    const matchesResult = await pool.query(`
      SELECT m.id, m.nba_game_id, m.game_time,
             ht.abbreviation as home_team,
             at.abbreviation as away_team
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.status = 'scheduled'
        AND m.game_time <= $1
        AND m.game_time > $2
      ORDER BY m.game_time
    `, [threshold, now]);

    console.log(`Found ${matchesResult.rows.length} matches to process\n`);

    if (matchesResult.rows.length === 0) {
      console.log('ℹ️  No upcoming matches within 36 hours');
      await pool.end();
      return result;
    }

    // Generate predictions for each match
    for (const match of matchesResult.rows) {
      try {
        const gameTime = new Date(match.game_time);
        const hoursUntil = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        console.log(`Processing: ${match.away_team} @ ${match.home_team}`);
        console.log(`  Game time: ${gameTime.toISOString()}`);
        console.log(`  Hours until game: ${hoursUntil.toFixed(1)}`);

        // Generate predictions
        const predictions = await generatePredictionsForMatch(match.id);

        console.log(`  ✓ Generated ${predictions.length} predictions\n`);

        result.matchesProcessed++;
        result.predictionsGenerated += predictions.length;

      } catch (error: any) {
        const errorMsg = `Error processing match ${match.nba_game_id}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}\n`);
        result.errors.push(errorMsg);
      }

      // Small delay to avoid overwhelming database
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('===========================================');
    console.log('✅ Prediction Generation Complete!');
    console.log('===========================================');
    console.log(`\n📊 Summary:`);
    console.log(`   - Matches processed: ${result.matchesProcessed}`);
    console.log(`   - Predictions generated: ${result.predictionsGenerated}`);
    console.log(`   - Errors: ${result.errors.length}\n`);

    if (result.errors.length > 0 && result.errors.length <= 5) {
      console.log('⚠️  Errors:');
      result.errors.forEach(err => console.log(`   - ${err}`));
      console.log();
    }

    return result;

  } catch (error) {
    console.error('❌ Error generating predictions:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  generatePredictionsForSchedule()
    .then(() => {
      console.log('✅ Script completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}
