/**
 * Fetch Upcoming Schedule
 *
 * Fetches and saves upcoming NBA games for the next 7 days
 */

import { fetchESPNScoreboard, convertESPNGame } from './espnApiClient';
import { saveESPNGame } from './espnDataStorage';
import pool from '../../config/database';

async function fetchUpcomingSchedule(daysAhead: number = 7) {
  console.log('\n===========================================');
  console.log(`🗓️  Fetching Upcoming Schedule (${daysAhead} days)`);
  console.log('===========================================\n');

  let totalGames = 0;
  const today = new Date();

  try {
    for (let i = 0; i <= daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      console.log(`Fetching ${dateStr}...`);

      const espnGames = await fetchESPNScoreboard(dateStr);
      const games = espnGames.map(g => convertESPNGame(g));

      if (games.length === 0) {
        console.log(`  ℹ️  No games scheduled\n`);
        continue;
      }

      console.log(`  ✓ Found ${games.length} game(s)`);

      for (const game of games) {
        const matchId = await saveESPNGame(game);
        console.log(`    ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} (${game.status}) - Match ID: ${matchId}`);
        totalGames++;
      }

      console.log();

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    console.log('===========================================');
    console.log('✅ Upcoming Schedule Fetched!');
    console.log('===========================================');
    console.log(`📊 Total games saved: ${totalGames}\n`);

  } catch (error) {
    console.error('❌ Error fetching schedule:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fetchUpcomingSchedule()
    .then(() => {
      console.log('✅ Schedule fetch completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Schedule fetch failed:', error);
      process.exit(1);
    });
}

export { fetchUpcomingSchedule };
