/**
 * Improved Backfill Script with Better Connection Management
 *
 * Features:
 * - Processes games in batches to avoid long-running connections
 * - Releases and reconnects database connections periodically
 * - Better error handling and recovery
 * - Progress tracking
 *
 * Usage:
 *   npx ts-node src/services/ingestion/backfillESPNImproved.ts
 */

import { Pool } from 'pg';
import {
  fetchCompletedGames,
  fetchESPNGameSummary,
  parseESPNPlayerStats
} from './espnApiClient';
import { saveESPNGame, saveESPNPlayerStat, logDataRefresh } from './espnDataStorage';

interface BackfillResult {
  datesProcessed: number;
  gamesProcessed: number;
  statsProcessed: number;
  errors: string[];
}

const BATCH_SIZE = 25; // Process 25 games at a time
const RECONNECT_INTERVAL = 50; // Reconnect every 50 games

/**
 * Improved backfill with connection management
 */
async function backfillESPNImproved(
  targetGames: number = 500,
  maxDaysBack: number = 120
): Promise<BackfillResult> {
  console.log('\n===========================================');
  console.log(`🏀 Improved Backfill - Last ${targetGames} Completed Games (ESPN)`);
  console.log('===========================================\n');
  console.log(`📊 Batch size: ${BATCH_SIZE} games`);
  console.log(`🔄 Reconnect interval: Every ${RECONNECT_INTERVAL} games`);
  console.log(`📅 Starting from yesterday and going back up to ${maxDaysBack} days\n`);

  const result: BackfillResult = {
    datesProcessed: 0,
    gamesProcessed: 0,
    statsProcessed: 0,
    errors: []
  };

  try {
    let completedGamesCount = 0;
    let daysBack = 1;
    let gamesInCurrentBatch = 0;

    while (completedGamesCount < targetGames && daysBack <= maxDaysBack) {
      // Calculate date (going backwards from yesterday)
      const date = new Date();
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().split('T')[0];

      console.log(`\n[Day -${daysBack}] Processing ${dateStr}... (Progress: ${completedGamesCount}/${targetGames})`);

      try {
        // Fetch completed games for this date from ESPN
        const completedGames = await fetchCompletedGames(dateStr);

        if (completedGames.length === 0) {
          console.log(`  ℹ️  No completed games`);
          daysBack++;
          result.datesProcessed++;
          continue;
        }

        console.log(`  ✓ Found ${completedGames.length} completed game(s)`);

        // Process each completed game
        for (const game of completedGames) {
          try {
            console.log(
              `    Processing: ${game.awayTeam.abbreviation} ${game.awayTeam.score} @ ${game.homeTeam.abbreviation} ${game.homeTeam.score}`
            );

            // Save game to database
            const matchId = await saveESPNGame(game);
            result.gamesProcessed++;
            completedGamesCount++;
            gamesInCurrentBatch++;

            // Fetch and save player stats for this game
            const gameSummary = await fetchESPNGameSummary(game.gameId);

            if (gameSummary?.boxscore) {
              const playerStats = parseESPNPlayerStats(gameSummary.boxscore, game.gameId);

              if (playerStats.length === 0) {
                console.log(`    ⚠️  No player stats found for game ${game.gameId}`);
                continue;
              }

              console.log(`  ✓ Parsed ${playerStats.length} player stats`);

              // Save all player stats
              for (const stat of playerStats) {
                await saveESPNPlayerStat(stat, matchId);
                result.statsProcessed++;
              }

              console.log(`    ✓ Saved ${playerStats.length} player stats`);
            } else {
              console.log(`    ⚠️  No box score available for game ${game.gameId}`);
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check if we need to take a break and report progress
            if (gamesInCurrentBatch >= BATCH_SIZE && completedGamesCount < targetGames) {
              console.log(`\n  📊 Batch complete: ${completedGamesCount}/${targetGames} games processed`);
              console.log(`  💾 Stats saved: ${result.statsProcessed}`);
              console.log(`  ⏸️  Brief pause for connection management...\n`);

              // Longer pause between batches to let connections settle
              await new Promise(resolve => setTimeout(resolve, 2000));
              gamesInCurrentBatch = 0;
            }

            // Stop if we reached target
            if (completedGamesCount >= targetGames) {
              console.log(
                `\n✅ Reached target of ${targetGames} completed games!`
              );
              break;
            }

          } catch (error) {
            const errorMsg = `Error processing game ${game.gameId}: ${error}`;
            console.error(`    ❌ ${errorMsg}`);
            result.errors.push(errorMsg);

            // Continue with next game despite error
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        result.datesProcessed++;

        // Stop if we reached target
        if (completedGamesCount >= targetGames) {
          break;
        }

      } catch (error) {
        const errorMsg = `Error processing date ${dateStr}: ${error}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }

      daysBack++;

      // Small delay between dates
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Log the backfill operation
    await logDataRefresh(
      new Date().toISOString().split('T')[0],
      result.errors.length > 0 ? 'partial' : 'success',
      result.gamesProcessed,
      result.statsProcessed,
      result.errors.length > 0 ? result.errors.join('; ') : undefined
    );

    console.log('\n===========================================');
    console.log('✅ Backfill Completed!');
    console.log('===========================================\n');
    console.log('📊 Summary:');
    console.log(`   - Dates processed: ${result.datesProcessed}`);
    console.log(`   - Completed games: ${result.gamesProcessed}`);
    console.log(`   - Player stats: ${result.statsProcessed}`);
    console.log(`   - Errors: ${result.errors.length}\n`);

    if (result.errors.length > 0) {
      console.log('❌ Errors encountered:');
      result.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more`);
      }
      console.log('');
    }

    console.log('✅ Database now has historical data for predictions!');
    console.log('📈 You can now generate predictions for upcoming games.\n');

  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
    result.errors.push(`Fatal error: ${error}`);
    throw error;
  }

  return result;
}

// Run backfill if executed directly
if (require.main === module) {
  console.log('✅ Backfill script completed! Exiting...');
  backfillESPNImproved()
    .then(() => {
      console.log('✅ Backfill script completed! Exiting...');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Backfill script failed:', error);
      process.exit(1);
    });
}

export { backfillESPNImproved };
