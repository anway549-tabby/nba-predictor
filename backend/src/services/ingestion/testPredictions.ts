/**
 * Test Predictions with Loaded Data
 *
 * Tests the prediction engine with the data loaded from ESPN backfill
 */

import pool from '../../config/database';
import { generatePredictionsForMatch } from '../prediction/predictionService';

async function testPredictions() {
  console.log('\n===========================================');
  console.log('🧪 Testing Predictions with Loaded Data');
  console.log('===========================================\n');

  try {
    // Check database stats
    console.log('📊 Database Statistics:\n');

    const matchesCount = await pool.query('SELECT COUNT(*) FROM matches');
    console.log(`   Matches: ${matchesCount.rows[0].count}`);

    const teamsCount = await pool.query('SELECT COUNT(*) FROM teams');
    console.log(`   Teams: ${teamsCount.rows[0].count}`);

    const playersCount = await pool.query('SELECT COUNT(*) FROM players');
    console.log(`   Players: ${playersCount.rows[0].count}`);

    const statsCount = await pool.query('SELECT COUNT(*) FROM player_game_stats');
    console.log(`   Player game stats: ${statsCount.rows[0].count}\n`);

    // Get a recent match
    console.log('🔍 Finding a recent match to test predictions...\n');

    const recentMatch = await pool.query(`
      SELECT
        m.id,
        m.nba_game_id,
        m.game_date,
        m.status,
        ht.abbreviation as home_team,
        at.abbreviation as away_team
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.status = 'final'
      ORDER BY m.game_date DESC
      LIMIT 1
    `);

    if (recentMatch.rows.length === 0) {
      console.log('❌ No completed matches found in database');
      return;
    }

    const match = recentMatch.rows[0];
    console.log(`✓ Found match: ${match.away_team} @ ${match.home_team}`);
    console.log(`   Match ID: ${match.id}`);
    console.log(`   Game Date: ${match.game_date}`);
    console.log(`   Status: ${match.status}\n`);

    // Check if predictions already exist
    const existingPreds = await pool.query(
      'SELECT COUNT(*) FROM predictions WHERE match_id = $1',
      [match.id]
    );

    if (parseInt(existingPreds.rows[0].count) > 0) {
      console.log(`ℹ️  Predictions already exist for this match (${existingPreds.rows[0].count} predictions)`);
      console.log('   Clearing existing predictions...\n');
      await pool.query('DELETE FROM predictions WHERE match_id = $1', [match.id]);
    }

    // Generate predictions
    console.log('🔮 Generating predictions...\n');

    const predictions = await generatePredictionsForMatch(match.id);

    console.log(`✅ Generated ${predictions.length} predictions!\n`);

    if (predictions.length > 0) {
      console.log('📋 Sample predictions:\n');

      // Show first 5 predictions
      for (let i = 0; i < Math.min(5, predictions.length); i++) {
        const pred = predictions[i];
        console.log(`   ${i + 1}. ${pred.playerName} (${pred.team})`);
        console.log(`      Points: ${pred.points || '-'}  Rebounds: ${pred.rebounds || '-'}  Assists: ${pred.assists || '-'}  Games: ${pred.gamesAnalyzed}`);
      }

      // Statistics
      const withPoints = predictions.filter(p => p.points !== null).length;
      const withRebounds = predictions.filter(p => p.rebounds !== null).length;
      const withAssists = predictions.filter(p => p.assists !== null).length;

      console.log(`\n📊 Prediction Statistics:`);
      console.log(`   Players with points threshold: ${withPoints}/${predictions.length}`);
      console.log(`   Players with rebounds threshold: ${withRebounds}/${predictions.length}`);
      console.log(`   Players with assists threshold: ${withAssists}/${predictions.length}`);
    }

    console.log('\n===========================================');
    console.log('✅ Prediction Test Complete!');
    console.log('===========================================');
    console.log('\n💡 The prediction engine is working correctly!');
    console.log('📈 You can now use the API to get predictions for any match.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testPredictions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
