/**
 * Check Prediction Status for Scheduled Games
 */

import pool from '../../config/database';

async function checkPredictionStatus() {
  try {
    // Total predictions
    const total = await pool.query('SELECT COUNT(*) as count FROM predictions');
    console.log('\n📊 PREDICTION STATUS\n');
    console.log('==========================================\n');
    console.log(`Total predictions in database: ${total.rows[0].count}`);

    // Predictions by match (next 36 hours)
    const now = new Date();
    const threshold = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    const byMatch = await pool.query(`
      SELECT
        m.id,
        m.game_time,
        ht.abbreviation as home,
        at.abbreviation as away,
        COUNT(p.id) as predictions
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      LEFT JOIN predictions p ON m.id = p.match_id
      WHERE m.status = 'scheduled'
        AND m.game_time < $1
        AND m.game_time > $2
      GROUP BY m.id, m.game_time, ht.abbreviation, at.abbreviation
      ORDER BY m.game_time
    `, [threshold, now]);

    console.log(`\nScheduled matches in next 36 hours (${byMatch.rows.length} matches):\n`);

    let matchesWithPredictions = 0;
    let totalPredictionsCount = 0;

    byMatch.rows.forEach(row => {
      const gameTime = new Date(row.game_time);
      const gameTimeIST = gameTime.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const predCount = parseInt(row.predictions);
      const status = predCount > 0 ? '✅' : '❌';

      console.log(`  ${status} ${row.away} @ ${row.home}`);
      console.log(`      Time: ${gameTimeIST} IST`);
      console.log(`      Predictions: ${predCount}`);
      console.log('');

      if (predCount > 0) {
        matchesWithPredictions++;
        totalPredictionsCount += predCount;
      }
    });

    console.log('==========================================');
    console.log(`\n✅ Matches with predictions: ${matchesWithPredictions}/${byMatch.rows.length}`);
    console.log(`📊 Total predictions for upcoming games: ${totalPredictionsCount}\n`);

    await pool.end();
  } catch (error) {
    console.error('Error checking prediction status:', error);
    process.exit(1);
  }
}

checkPredictionStatus();
