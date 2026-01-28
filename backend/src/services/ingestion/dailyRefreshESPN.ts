/**
 * Daily Data Refresh Job (ESPN)
 *
 * Runs every day at 12:00 Noon IST
 * 1. Fetches completed games from yesterday (ESPN)
 * 2. Fetches and saves player stats for those games
 * 3. Fetches upcoming games for today
 * 4. Generates predictions for upcoming games within 24 hours
 *
 * Usage:
 *   npx ts-node src/services/ingestion/dailyRefreshESPN.ts
 */

import {
  fetchCompletedGames,
  fetchESPNScoreboard,
  fetchESPNGameSummary,
  parseESPNPlayerStats,
  convertESPNGame
} from './espnApiClient';
import { saveESPNGame, saveESPNPlayerStat, logDataRefresh } from './espnDataStorage';
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
 * Fetches data for yesterday (completed) and today (upcoming) using ESPN
 */
export async function runDailyRefreshESPN(): Promise<DailyRefreshResult> {
  console.log('\n===========================================');
  console.log('🔄 Daily NBA Data Refresh (ESPN)');
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
    // Calculate yesterday and today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`📅 Today: ${todayStr}`);
    console.log(`📅 Yesterday: ${yesterdayStr}\n`);

    // ============================================
    // STEP 1: Fetch completed games from yesterday
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 STEP 1: Fetching Completed Games (Yesterday)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const completedGames = await fetchCompletedGames(yesterdayStr);

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
          console.log(`Processing: ${game.awayTeam.abbreviation} ${game.awayTeam.score} @ ${game.homeTeam.abbreviation} ${game.homeTeam.score}`);

          // Save game
          const matchId = await saveESPNGame(game);
          result.completedGames++;

          // Fetch player stats
          const gameSummary = await fetchESPNGameSummary(game.gameId);

          if (gameSummary?.boxscore) {
            const playerStats = parseESPNPlayerStats(gameSummary.boxscore, game.gameId);

            if (playerStats.length === 0) {
              console.log(`  ⚠️  No player stats found`);
              continue;
            }

            // Save player stats
            for (const stat of playerStats) {
              await saveESPNPlayerStat(stat, matchId);
              result.playerStats++;
            }

            console.log(`  ✓ Saved ${playerStats.length} player stats\n`);
          } else {
            console.log(`  ⚠️  No box score available\n`);
          }

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
    console.log('📅 STEP 3: Fetching Upcoming Games (Today)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const todayGames = await fetchESPNScoreboard(todayStr);
    const upcomingGames = todayGames
      .map(g => convertESPNGame(g))
      .filter(g => g.status === 'scheduled');

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
          const matchId = await saveESPNGame(game);
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
      todayStr,
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
      new Date().toISOString().split('T')[0],
      'failed',
      0,
      0,
      (error as Error).message
    );

    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runDailyRefreshESPN()
    .then(() => {
      console.log('✅ Daily refresh script completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Daily refresh script failed:', error);
      process.exit(1);
    });
}
