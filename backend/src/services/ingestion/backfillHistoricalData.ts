/**
 * Backfill Historical Data Script
 *
 * Fetches NBA game and player stats data for the past 60 days
 * This provides enough historical data for prediction generation
 *
 * Usage:
 *   npx ts-node src/services/ingestion/backfillHistoricalData.ts [days]
 *
 * Example:
 *   npx ts-node src/services/ingestion/backfillHistoricalData.ts 60
 */

import { fetchGames, fetchAllPlayerStats } from './nbaApiClient';
import { saveMatch, savePlayerGameStats } from './dataStorage';

interface BackfillStats {
  totalDays: number;
  daysProcessed: number;
  totalGames: number;
  totalPlayerStats: number;
  errors: Array<{ date: string; error: string }>;
}

/**
 * Backfill data for a date range
 * @param startDaysAgo - How many days ago to start (e.g., 60 for 60 days ago)
 * @param endDaysAgo - How many days ago to end (e.g., 1 for yesterday)
 */
async function backfillHistoricalData(
  startDaysAgo: number = 60,
  endDaysAgo: number = 1
): Promise<BackfillStats> {
  console.log('\n===========================================');
  console.log('🏀 NBA Historical Data Backfill');
  console.log('===========================================\n');

  const stats: BackfillStats = {
    totalDays: 0,
    daysProcessed: 0,
    totalGames: 0,
    totalPlayerStats: 0,
    errors: []
  };

  try {
    // Generate date range (from oldest to most recent)
    const dates: string[] = [];
    for (let i = startDaysAgo; i >= endDaysAgo; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    stats.totalDays = dates.length;
    console.log(`📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
    console.log(`📊 Total days to process: ${stats.totalDays}\n`);

    // Process each date
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const progress = ((i + 1) / dates.length * 100).toFixed(1);

      console.log(`\n[${i + 1}/${dates.length}] (${progress}%) Processing ${date}...`);

      try {
        // Fetch games for this date
        const games = await fetchGames(date);

        if (games.length === 0) {
          console.log(`  ℹ️  No games on ${date}`);
          stats.daysProcessed++;
          continue;
        }

        console.log(`  ✓ Found ${games.length} games`);

        // Save games and collect match IDs
        const matchIds: Map<number, number> = new Map();
        for (const game of games) {
          const matchId = await saveMatch(game);
          matchIds.set(game.id, matchId);
          stats.totalGames++;
        }

        console.log(`  ✓ Saved ${games.length} games to database`);

        // Fetch player stats for this date
        const playerStats = await fetchAllPlayerStats(date);

        if (playerStats.length === 0) {
          console.log(`  ⚠️  No player stats found for ${date}`);
          stats.daysProcessed++;
          continue;
        }

        console.log(`  ✓ Found ${playerStats.length} player stats`);

        // Save player stats
        let savedCount = 0;
        for (const stat of playerStats) {
          const matchId = matchIds.get(stat.game.id);
          if (matchId) {
            await savePlayerGameStats(stat, matchId);
            savedCount++;
          }
        }

        stats.totalPlayerStats += savedCount;
        console.log(`  ✓ Saved ${savedCount} player stats`);

        stats.daysProcessed++;

        // Small delay to avoid rate limiting (0.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Error processing ${date}:`, errorMessage);
        stats.errors.push({ date, error: errorMessage });

        // If rate limited, wait longer
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          console.log('  ⏳ Rate limited - waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    }

    // Print summary
    console.log('\n===========================================');
    console.log('✅ Historical Data Backfill Completed!');
    console.log('===========================================');
    console.log(`\n📊 Summary:`);
    console.log(`   - Days processed: ${stats.daysProcessed}/${stats.totalDays}`);
    console.log(`   - Total games saved: ${stats.totalGames}`);
    console.log(`   - Total player stats saved: ${stats.totalPlayerStats}`);
    console.log(`   - Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(({ date, error }) => {
        console.log(`   - ${date}: ${error}`);
      });
    }

    console.log('\n✅ Database now has historical data for predictions!');

    return stats;

  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const daysToBackfill = args[0] ? parseInt(args[0]) : 60;

  console.log(`\n📥 Starting backfill for last ${daysToBackfill} days...\n`);

  backfillHistoricalData(daysToBackfill, 1)
    .then(() => {
      console.log('\n✅ Backfill complete! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Backfill failed:', error);
      process.exit(1);
    });
}

export { backfillHistoricalData };
