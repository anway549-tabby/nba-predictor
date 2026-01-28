/**
 * Daily Data Refresh Job
 *
 * Runs every day at 12:00 Noon IST
 * 1. Fetches completed games from last 24 hours
 * 2. Fetches and saves player stats for those games
 * 3. Fetches upcoming games (next 24 hours)
 * 4. Generates predictions for upcoming games
 *
 * Usage:
 *   npx ts-node src/services/ingestion/dailyRefreshJob.ts
 */

import {
  fetchScheduleForDate,
  fetchPlayerStatsForGame,
  getTodayIST,
  getYesterdayIST
} from './freeNbaClient';
import { saveFreeGame, saveFreePlayerStat, logDataRefresh } from './freeDataStorage';
import { generatePredictionsForMatch } from '../prediction/predictionService';
import pool from '../../config/database';

interface DailyRefreshResult {
  completedGames: number;
  upcomingGames: number;
  playerStats: number;
  predictions: number;
  errors: string[];
}

/**
 * Main daily refresh function
 * Fetches data for yesterday (completed) and today (upcoming)
 */
export async function runDailyRefresh(): Promise<DailyRefreshResult> {
  console.log('\n===========================================');
  console.log('🔄 Daily NBA Data Refresh');
  console.log('🕛 Scheduled for 12:00 Noon IST');
  console.log('===========================================\n');

  const startTime = Date.now();
  const result: DailyRefreshResult = {
    completedGames: 0,
    upcomingGames: 0,
    playerStats: 0,
    predictions: 0,
    errors: []
  };

  try {
    const yesterday = getYesterdayIST();
    const today = getTodayIST();

    console.log(`📅 Today (IST): ${today}`);
    console.log(`📅 Yesterday (IST): ${yesterday}\n`);

    // ============================================
    // STEP 1: Fetch completed games from yesterday
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 STEP 1: Fetching Completed Games');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const yesterdayGames = await fetchScheduleForDate(yesterday);
    const completedGames = yesterdayGames.filter(g => g.status === 'final');

    console.log(`✓ Found ${completedGames.length} completed games from yesterday\n`);

    if (completedGames.length === 0) {
      console.log('ℹ️  No completed games to process\n');
    }

    // ============================================
    // STEP 2: Save games and fetch player stats
    // ============================================
    if (completedGames.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💾 STEP 2: Saving Games & Player Stats');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      for (const game of completedGames) {
        try {
          console.log(`Processing: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);

          // Save game
          const matchId = await saveFreeGame(game);
          result.completedGames++;

          // Fetch player stats
          const playerStats = await fetchPlayerStatsForGame(game.gameId);

          if (playerStats.length === 0) {
            console.log(`  ⚠️  No player stats found`);
            continue;
          }

          // Save player stats
          for (const stat of playerStats) {
            await saveFreePlayerStat(stat, matchId);
            result.playerStats++;
          }

          console.log(`  ✓ Saved ${playerStats.length} player stats\n`);

          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          const errorMsg = `Error processing game ${game.gameId}: ${error}`;
          console.error(`  ❌ ${errorMsg}\n`);
          result.errors.push(errorMsg);
        }
      }
    }

    // ============================================
    // STEP 3: Fetch upcoming games (today)
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 STEP 3: Fetching Upcoming Games');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const todayGames = await fetchScheduleForDate(today);
    const upcomingGames = todayGames.filter(g => g.status === 'scheduled');

    console.log(`✓ Found ${upcomingGames.length} upcoming games for today\n`);

    if (upcomingGames.length === 0) {
      console.log('ℹ️  No upcoming games to process\n');
    }

    // ============================================
    // STEP 4: Save upcoming games and generate predictions
    // ============================================
    if (upcomingGames.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 STEP 4: Saving Games & Generating Predictions');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      for (const game of upcomingGames) {
        try {
          console.log(`Processing: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);

          // Save game
          const matchId = await saveFreeGame(game);
          result.upcomingGames++;

          // Check if game is within 24 hours
          const gameTime = new Date(game.gameTime);
          const now = new Date();
          const hoursUntilGame = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursUntilGame <= 24 && hoursUntilGame >= 0) {
            console.log(`  ⏰ Game starts in ${hoursUntilGame.toFixed(1)} hours - generating predictions...`);

            // Generate predictions
            const predictions = await generatePredictionsForMatch(matchId);
            result.predictions += predictions.length;

            console.log(`  ✓ Generated ${predictions.length} predictions\n`);
          } else {
            console.log(`  ⏱️  Game is ${hoursUntilGame > 24 ? 'more than 24 hours away' : 'in the past'} - skipping predictions\n`);
          }

          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
          const errorMsg = `Error processing upcoming game ${game.gameId}: ${error}`;
          console.error(`  ❌ ${errorMsg}\n`);
          result.errors.push(errorMsg);
        }
      }
    }

    // ============================================
    // STEP 5: Log the refresh operation
    // ============================================
    await logDataRefresh(
      today,
      result.errors.length > 0 ? 'partial' : 'success',
      result.completedGames + result.upcomingGames,
      result.playerStats,
      result.errors.length > 0 ? `${result.errors.length} errors occurred` : undefined
    );

    // ============================================
    // Summary
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Daily Refresh Completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Summary:`);
    console.log(`   ⏱️  Duration: ${duration} seconds`);
    console.log(`   📅 Completed games processed: ${result.completedGames}`);
    console.log(`   📊 Player stats saved: ${result.playerStats}`);
    console.log(`   🎯 Upcoming games saved: ${result.upcomingGames}`);
    console.log(`   🔮 Predictions generated: ${result.predictions}`);
    console.log(`   ❌ Errors: ${result.errors.length}`);

    if (result.errors.length > 0 && result.errors.length <= 5) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n✅ Next refresh: Tomorrow at 12:00 Noon IST\n');

    return result;

  } catch (error) {
    console.error('\n❌ Daily refresh failed:', error);

    // Log failed refresh
    await logDataRefresh(
      getTodayIST(),
      'failed',
      0,
      0,
      (error as Error).message
    );

    throw error;
  }
}

/**
 * Setup cron job for daily refresh at 12:00 Noon IST
 * This is just a placeholder - actual scheduling should be done with node-cron or system cron
 */
export function setupDailyRefreshCron() {
  console.log('\n📅 Setting up daily refresh cron job...');
  console.log('⏰ Schedule: Every day at 12:00 Noon IST (06:30 UTC)');

  // Note: Actual cron setup should be done in the main server file
  // This is just documentation
  console.log('\n💡 To set up with node-cron, add to your server:');
  console.log(`
    import cron from 'node-cron';
    import { runDailyRefresh } from './services/ingestion/dailyRefreshJob';

    // Run every day at 12:00 Noon IST (6:30 AM UTC)
    cron.schedule('30 6 * * *', async () => {
      console.log('Running daily refresh job...');
      await runDailyRefresh();
    }, {
      timezone: "UTC"
    });
  `);

  console.log('\n💡 Or set up with system cron:');
  console.log('  30 6 * * * cd /path/to/project && npm run refresh:daily\n');
}

// Run if called directly
if (require.main === module) {
  runDailyRefresh()
    .then(() => {
      console.log('✅ Daily refresh script completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Daily refresh script failed:', error);
      process.exit(1);
    });
}
