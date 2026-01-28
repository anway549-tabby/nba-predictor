/**
 * Check how game dates and times are stored
 */

import pool from '../../config/database';

async function checkGameDates() {
  console.log('\n📅 Checking Game Date/Time Storage\n');
  console.log('==========================================\n');

  try {
    // Get sample matches
    const matches = await pool.query(`
      SELECT m.id, m.game_date, m.game_time, m.status,
             ht.abbreviation as home, at.abbreviation as away
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.id IN (52, 53, 54, 55)
      ORDER BY m.game_time
    `);

    console.log('Sample matches from database:\n');

    matches.rows.forEach(match => {
      const gameTime = new Date(match.game_time);
      const gameDate = new Date(match.game_date);

      // Convert to IST by adding 5:30 hours
      const gameTimeIST = new Date(gameTime.getTime() + (5.5 * 60 * 60 * 1000));
      const istDateFromTime = gameTimeIST.toISOString().split('T')[0];
      const storedDate = gameDate.toISOString().split('T')[0];

      console.log(`Match ${match.id}: ${match.away} @ ${match.home} (${match.status})`);
      console.log(`  Stored game_date: ${storedDate}`);
      console.log(`  Stored game_time: ${gameTime.toISOString()}`);
      console.log(`  IST time: ${gameTimeIST.toISOString()}`);
      console.log(`  IST date (calculated): ${istDateFromTime}`);
      console.log(`  ❌ MISMATCH: ${storedDate !== istDateFromTime ? 'YES - game_date is wrong!' : 'NO - dates match'}`);
      console.log('');
    });

    console.log('==========================================\n');
    console.log('Issue: game_date field stores the EST/UTC date, not IST date');
    console.log('Solution: Always calculate IST date from game_time, ignore game_date\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkGameDates();
