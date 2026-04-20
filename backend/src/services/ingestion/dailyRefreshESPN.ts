/**
 * Daily Data Refresh Job (ESPN)
 *
 * Runs every day at 12:00 Noon IST
 * 1. Fetches completed games from yesterday (ESPN)
 * 2. Fetches and saves player stats for those games
 * 3. Fetches upcoming games for the next 7 days (PRD requirement)
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
import { saveESPNGame, saveESPNPlayerStat, logDataRefresh, isNBATeam } from './espnDataStorage';
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

    const allCompletedGames = await fetchCompletedGames(yesterdayStr);

    // Filter out All-Star / exhibition games
    const completedGames = allCompletedGames.filter(g =>
      isNBATeam(g.homeTeam.abbreviation) && isNBATeam(g.awayTeam.abbreviation)
    );
    const skippedCompleted = allCompletedGames.length - completedGames.length;
    if (skippedCompleted > 0) console.log(`⏭️  Skipped ${skippedCompleted} non-NBA game(s) (All-Star/exhibition)\n`);

    console.log(`✓ Found ${completedGames.length} completed NBA games from yesterday\n`);

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
    // STEP 3: Fetch upcoming games (next 7 days starting from TOMORROW)
    // ============================================
    // PRD: After 12:00 Noon IST refresh, today should not be available
    // Schedule shows tomorrow + next 6 days = 7 days total
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 STEP 3: Fetching Upcoming Games (Tomorrow + 6 Days)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const upcomingGames: any[] = [];

    // Fetch games for the next 7 days starting from TOMORROW (daysAhead = 1)
    // PRD: Today's games are not shown after noon refresh
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const dateStr = targetDate.toISOString().split('T')[0];

      console.log(`  Fetching games for ${dateStr}...`);

      try {
        const dayGames = await fetchESPNScoreboard(dateStr);
        const scheduledGames = dayGames
          .map(g => convertESPNGame(g))
          .filter(g => g.status === 'scheduled');

        console.log(`    ✓ Found ${scheduledGames.length} scheduled games`);
        upcomingGames.push(...scheduledGames);

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`    ❌ Error fetching games for ${dateStr}:`, error);
        result.errors.push(`Failed to fetch games for ${dateStr}`);
      }
    }

    console.log(`\n✓ Total upcoming games found: ${upcomingGames.length}\n`);

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
          console.log(`Processing: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} (${game.gameDate})`);

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
    // STEP 5: Catch-all — generate predictions for any DB-scheduled match
    // within 24 hours that still has 0 predictions.
    // Needed because ESPN schedule dates are ET-based while our fetch loop
    // uses UTC dates, causing late-night ET games to be missed above.
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 STEP 5: Catch-all Prediction Check (DB scan)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      const unpredictedMatches = await pool.query(`
        SELECT m.id, m.game_time,
               ht.abbreviation as home, at.abbreviation as away
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        WHERE m.status = 'scheduled'
          AND m.game_time > NOW()
          AND m.game_time <= NOW() + INTERVAL '24 hours'
          AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.match_id = m.id)
        ORDER BY m.game_time
      `);

      if (unpredictedMatches.rows.length === 0) {
        console.log('✓ No missed matches — all upcoming 24h games have predictions\n');
      } else {
        console.log(`⚠️  Found ${unpredictedMatches.rows.length} match(es) within 24h with no predictions\n`);
        for (const row of unpredictedMatches.rows) {
          const hoursUntil = ((new Date(row.game_time).getTime() - Date.now()) / 3600000).toFixed(1);
          console.log(`  Generating for: ${row.away} @ ${row.home} (in ${hoursUntil}h)...`);
          try {
            const preds = await generatePredictionsForMatch(row.id);
            result.predictions += preds.length;
            console.log(`  ✓ Generated ${preds.length} predictions\n`);
          } catch (err) {
            const msg = `Catch-all prediction failed for match ${row.id}: ${err}`;
            console.error(`  ❌ ${msg}\n`);
            result.errors.push(msg);
          }
        }
      }
    } catch (err) {
      console.error('❌ Catch-all prediction step failed:', err);
    }

    // ============================================
    // STEP 6: Log the refresh operation
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
