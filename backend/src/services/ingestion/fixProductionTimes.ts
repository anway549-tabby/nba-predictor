/**
 * Fix Production Schedule Times
 * Re-fetch correct times from ESPN and update production database
 */

import { Pool } from 'pg';
import { fetchESPNScoreboard, convertESPNGame } from './espnApiClient';

// Production database with SSL
const prodPool = new Pool({
  connectionString: 'postgresql://postgres:lbBwMcWHAXSCMcvXPjDRdDWZOIeRFtwN@autorack.proxy.rlwy.net:48702/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixProductionTimes() {
  console.log('\n===========================================');
  console.log('🔄 Fixing Production Schedule Times from ESPN');
  console.log('===========================================\n');

  const client = await prodPool.connect();
  let updated = 0;
  let unchanged = 0;

  try {
    await client.query('BEGIN');

    // Get all scheduled matches
    const scheduled = await client.query(`
      SELECT id, nba_game_id, game_date, game_time,
             (SELECT abbreviation FROM teams WHERE id = home_team_id) as home,
             (SELECT abbreviation FROM teams WHERE id = away_team_id) as away
      FROM matches
      WHERE status = 'scheduled'
      ORDER BY game_date
    `);

    console.log(`Found ${scheduled.rows.length} scheduled matches\n`);

    if (scheduled.rows.length === 0) {
      console.log('No scheduled matches to update\n');
      await client.query('COMMIT');
      client.release();
      await prodPool.end();
      return;
    }

    // Group by date to minimize API calls
    const dateMap = new Map<string, any[]>();
    for (const match of scheduled.rows) {
      const date = match.game_date.toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(match);
    }

    console.log(`Processing ${dateMap.size} unique dates\n`);

    // Process each date
    for (const [date, matches] of dateMap.entries()) {
      console.log(`📅 Fetching games for ${date}...`);

      try {
        const espnGames = await fetchESPNScoreboard(date);
        console.log(`   Found ${espnGames.length} games from ESPN`);

        for (const match of matches) {
          const espnGame = espnGames.find(g => g.id === match.nba_game_id);

          if (espnGame) {
            const converted = convertESPNGame(espnGame);

            // Check if time changed
            const oldTime = new Date(match.game_time);
            const newTime = new Date(converted.gameTime);

            if (oldTime.getTime() !== newTime.getTime()) {
              // Display in IST for clarity
              const oldIST = oldTime.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour12: true,
                hour: 'numeric',
                minute: '2-digit',
                day: 'numeric',
                month: 'short'
              });
              const newIST = newTime.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour12: true,
                hour: 'numeric',
                minute: '2-digit',
                day: 'numeric',
                month: 'short'
              });

              console.log(`   🔄 Updating ${match.away} @ ${match.home}:`);
              console.log(`      OLD: ${oldIST} IST (${oldTime.toISOString()})`);
              console.log(`      NEW: ${newIST} IST (${newTime.toISOString()})`);

              // Update the match time
              await client.query(
                'UPDATE matches SET game_time = $1, game_date = $2 WHERE id = $3',
                [newTime, new Date(converted.gameDate), match.id]
              );

              updated++;
            } else {
              unchanged++;
            }
          } else {
            console.log(`   ⚠️  Game ${match.nba_game_id} not found in ESPN response`);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));

      } catch (error) {
        console.error(`   ❌ Error fetching ${date}:`, error);
      }
    }

    console.log('\n🔄 Committing transaction...');
    await client.query('COMMIT');
    console.log('✓ Transaction committed successfully');

    console.log('\n===========================================');
    console.log('✅ Schedule Times Fixed!');
    console.log('===========================================');
    console.log(`📊 Summary:`);
    console.log(`   - Updated: ${updated} matches`);
    console.log(`   - Unchanged: ${unchanged} matches`);
    console.log(`   - Total processed: ${scheduled.rows.length} matches\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await prodPool.end();
  }
}

// Run
fixProductionTimes()
  .then(() => {
    console.log('✅ Script completed! Exiting...\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
