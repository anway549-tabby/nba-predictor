/**
 * Backfill Last 15 Completed Games using ESPN API
 *
 * Fetches completed NBA games from ESPN and backfills until we have
 * at least 15 completed games worth of data for predictions
 *
 * Usage:
 *   npx ts-node src/services/ingestion/backfillESPN.ts
 */

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

/**
 * Backfill last completed games from ESPN
 * @param targetGames - Number of completed games to aim for (default 15)
 * @param maxDaysBack - Maximum days to look back (default 30)
 */
async function backfillESPN(
  targetGames: number = 500,
  maxDaysBack: number = 120
): Promise<BackfillResult> {
  console.log('\n===========================================');
  console.log(`🏀 Backfilling Last ${targetGames} Completed Games (ESPN)`);
  console.log('===========================================\n');

  const result: BackfillResult = {
    datesProcessed: 0,
    gamesProcessed: 0,
    statsProcessed: 0,
    errors: []
  };

  try {
    let completedGamesCount = 0;
    let daysBack = 1;

    console.log(`📊 Target: ${targetGames} completed games`);
    console.log(`📅 Starting from yesterday and going back up to ${maxDaysBack} days\n`);

    while (completedGamesCount < targetGames && daysBack <= maxDaysBack) {
      // Calculate date (going backwards from yesterday)
      const date = new Date();
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().split('T')[0];

      console.log(`\n[Day -${daysBack}] Processing ${dateStr}...`);

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

            // Fetch and save player stats for this game
            const gameSummary = await fetchESPNGameSummary(game.gameId);

            if (gameSummary?.boxscore) {
              const playerStats = parseESPNPlayerStats(gameSummary.boxscore, game.gameId);

              if (playerStats.length === 0) {
                console.log(`    ⚠️  No player stats found for game ${game.gameId}`);
                continue;
              }

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
      result.errors.length > 0 ? `Backfill had ${result.errors.length} errors` : undefined
    );

    // Print summary
    console.log('\n===========================================');
    console.log('✅ Backfill Completed!');
    console.log('===========================================');
    console.log(`\n📊 Summary:`);
    console.log(`   - Dates processed: ${result.datesProcessed}`);
    console.log(`   - Completed games: ${result.gamesProcessed}`);
    console.log(`   - Player stats: ${result.statsProcessed}`);
    console.log(`   - Errors: ${result.errors.length}`);

    if (result.errors.length > 0 && result.errors.length <= 5) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n✅ Database now has historical data for predictions!');
    console.log('📈 You can now generate predictions for upcoming games.\n');

    return result;

  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  backfillESPN()
    .then(() => {
      console.log('✅ Backfill script completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill script failed:', error);
      process.exit(1);
    });
}

export { backfillESPN };
