/**
 * Fix Match 52 specifically
 * Generate predictions for this match on production database
 */

import { Pool } from 'pg';
import { generatePredictionsForMatch } from '../prediction/predictionService';

// Use production DATABASE_URL
const prodPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:lbBwMcWHAXSCMcvXPjDRdDWZOIeRFtwN@autorack.proxy.rlwy.net:48702/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixMatch52() {
  console.log('\n🔧 Fixing Match 52 on Production');
  console.log('==========================================\n');

  try {
    // Check match 52
    const match = await prodPool.query(`
      SELECT m.id, m.game_time, m.status,
             ht.abbreviation as home,
             at.abbreviation as away
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.id = 52
    `);

    if (match.rows.length === 0) {
      console.log('❌ Match 52 not found in production\n');
      return;
    }

    const m = match.rows[0];
    console.log(`Match 52: ${m.away} @ ${m.home}`);
    console.log(`Game time: ${m.game_time}`);
    console.log(`Status: ${m.status}\n`);

    // Check current predictions
    const preds = await prodPool.query('SELECT COUNT(*) FROM predictions WHERE match_id = 52');
    console.log(`Current predictions: ${preds.rows[0].count}\n`);

    // Generate predictions
    console.log('Generating predictions...\n');
    const result = await generatePredictionsForMatch(52);

    console.log(`\n✅ Generated ${result.length} predictions for match 52\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prodPool.end();
  }
}

// Run
fixMatch52()
  .then(() => {
    console.log('✅ Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
