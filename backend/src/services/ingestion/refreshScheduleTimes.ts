/**
 * Refresh Schedule Times
 *
 * Re-fetches all scheduled games from ESPN to update their times
 */

import pool from '../../config/database';
import { fetchESPNScoreboard, convertESPNGame } from './espnApiClient';

async function refreshScheduleTimes() {
  console.log('\n===========================================');
  console.log('🔄 Refreshing Schedule Times from ESPN');
  console.log('===========================================\n');

  const client = await pool.connect();
  let updated = 0;

  try {
    await client.query('BEGIN');

    // Get all scheduled matches
    const scheduled = await client.query(`
      SELECT id, nba_game_id, game_date, game_time
      FROM matches
      WHERE status = 'scheduled'
      ORDER BY game_date
    `);

    console.log(`Found ${scheduled.rows.length} scheduled matches\n`);

    // Group by date to minimize API calls
    const dateMap = new Map<string, any[]>();
    for (const match of scheduled.rows) {
      const date = match.game_date.toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(match);
    }

    // Process each date
    for (const [date, matches] of dateMap.entries()) {
      console.log(`Fetching games for ${date}...`);

      try {
        const espnGames = await fetchESPNScoreboard(date);

        for (const match of matches) {
          const espnGame = espnGames.find(g => g.id === match.nba_game_id);

          if (espnGame) {
            const converted = convertESPNGame(espnGame);

            // Check if time changed
            const oldTime = new Date(match.game_time);
            const newTime = new Date(converted.gameTime);

            if (oldTime.getTime() !== newTime.getTime()) {
              // Update the match time (must pass Date objects, not strings)
              const gameTimeDate = new Date(converted.gameTime);
              const gameDateDate = new Date(converted.gameDate);

              const updateResult = await client.query(
                'UPDATE matches SET game_time = $1, game_date = $2 WHERE id = $3 RETURNING id, game_time, game_date',
                [gameTimeDate, gameDateDate, match.id]
              );

              const oldIST = oldTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit' });
              const newIST = newTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit' });

              console.log(`  ✓ Updated ${match.nba_game_id}: ${oldIST} → ${newIST} IST`);
              console.log(`    DB returned: game_time=${updateResult.rows[0]?.game_time}, game_date=${updateResult.rows[0]?.game_date}`);
              updated++;
            }
          } else {
            console.log(`  ⚠️  Game ${match.nba_game_id} not found in ESPN response`);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));

      } catch (error) {
        console.error(`  ❌ Error fetching ${date}:`, error);
      }
    }

    console.log('\n🔄 Committing transaction...');
    await client.query('COMMIT');
    console.log('✓ Transaction committed successfully');

    // Verify one game after commit
    const verifyGame = await client.query('SELECT nba_game_id, game_time FROM matches WHERE nba_game_id = $1', ['401810519']);
    if (verifyGame.rows.length > 0) {
      console.log(`\n🔍 Post-commit verification for 401810519:`);
      console.log(`   game_time = ${verifyGame.rows[0].game_time}`);
    }

    console.log('\n===========================================');
    console.log('✅ Schedule Times Refreshed!');
    console.log('===========================================');
    console.log(`📊 Updated ${updated} match times\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Close pool after a brief delay to ensure commit is flushed
async function closePool() {
  await new Promise(resolve => setTimeout(resolve, 500));
  await pool.end();
}

if (require.main === module) {
  refreshScheduleTimes()
    .then(async () => {
      console.log('✅ Script completed! Exiting...\n');
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('❌ Script failed:', error);
      await closePool();
      process.exit(1);
    });
}

export { refreshScheduleTimes };
