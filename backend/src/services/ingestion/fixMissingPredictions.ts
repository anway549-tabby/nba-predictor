/**
 * Fix Missing Predictions
 * Re-generate predictions for matches that have 0 predictions
 */

import pool from '../../config/database';
import { generatePredictionsForMatch } from '../prediction/predictionService';

async function fixMissingPredictions() {
  console.log('\n🔧 Fixing Missing Predictions');
  console.log('==========================================\n');

  try {
    // Get all scheduled matches within next 36 hours that have 0 predictions
    const now = new Date();
    const threshold = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    const matchesWithNoPreds = await pool.query(`
      SELECT
        m.id,
        m.game_time,
        ht.abbreviation as home,
        at.abbreviation as away,
        COUNT(p.id) as pred_count
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      LEFT JOIN predictions p ON m.id = p.match_id
      WHERE m.status = 'scheduled'
        AND m.game_time <= $1
        AND m.game_time > $2
      GROUP BY m.id, m.game_time, ht.abbreviation, at.abbreviation
      HAVING COUNT(p.id) = 0
      ORDER BY m.game_time
    `, [threshold, now]);

    console.log(`Found ${matchesWithNoPreds.rows.length} matches with 0 predictions\n`);

    if (matchesWithNoPreds.rows.length === 0) {
      console.log('✅ All matches have predictions!\n');
      await pool.end();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each match individually (avoid transaction issues)
    for (const match of matchesWithNoPreds.rows) {
      const gameTime = new Date(match.game_time);
      const gameTimeIST = gameTime.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      console.log(`\n[${match.id}] ${match.away} @ ${match.home}`);
      console.log(`  Game time: ${gameTimeIST} IST`);

      try {
        // Generate predictions using individual connection
        const predictions = await generatePredictionsForMatch(match.id);

        console.log(`  ✅ Generated ${predictions.length} predictions`);
        successCount++;

        // Small delay between matches
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`  ❌ Error: ${error instanceof Error ? error.message : error}`);
        errorCount++;
      }
    }

    console.log('\n==========================================');
    console.log('✅ Fix Complete!\n');
    console.log(`Success: ${successCount} matches`);
    console.log(`Errors: ${errorCount} matches\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  fixMissingPredictions()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { fixMissingPredictions };
