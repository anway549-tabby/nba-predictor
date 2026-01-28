/**
 * Robust Backfill Script
 *
 * Backfills games in small batches with better error handling
 * Can resume from where it left off
 */

import {
  fetchCompletedGames,
  fetchESPNGameSummary,
  parseESPNPlayerStats
} from './espnApiClient';
import { saveESPNGame, saveESPNPlayerStat } from './espnDataStorage';
import pool from '../../config/database';

async function backfillRobust() {
  console.log('\n===========================================');
  console.log('🏀 Robust Backfill (500 games)');
  console.log('===========================================\n');

  let completedGamesCount = 0;
  let daysBack = 1;
  const maxDaysBack = 120;
  const targetGames = 500;

  try {
    // Check current count
    const currentCount = await pool.query('SELECT COUNT(*) as count FROM matches');
    console.log(`📊 Current matches in database: ${currentCount.rows[0].count}`);
    console.log(`📊 Target: ${targetGames} matches\n`);

    while (completedGamesCount < targetGames && daysBack <= maxDaysBack) {
      const date = new Date();
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().split('T')[0];

      console.log(`[Day -${daysBack}] ${dateStr}...`);

      try {
        const completedGames = await fetchCompletedGames(dateStr);

        if (completedGames.length === 0) {
          console.log(`  No games`);
          daysBack++;
          continue;
        }

        console.log(`  ${completedGames.length} games`);

        // Process each game
        for (const game of completedGames) {
          try {
            console.log(`    ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);

            // Save game
            const matchId = await saveESPNGame(game);
            completedGamesCount++;

            // Fetch and save stats
            const gameSummary = await fetchESPNGameSummary(game.gameId);

            if (gameSummary?.boxscore) {
              const playerStats = parseESPNPlayerStats(gameSummary.boxscore, game.gameId);

              if (playerStats.length > 0) {
                // Save stats one by one
                let savedCount = 0;
                for (const stat of playerStats) {
                  try {
                    await saveESPNPlayerStat(stat, matchId);
                    savedCount++;
                  } catch (err) {
                    // Skip individual stat errors
                    console.log(`      ⚠️  Skipped 1 stat`);
                  }
                }
                console.log(`      ✓ ${savedCount} stats`);
              }
            }

            // Delay between games
            await new Promise(r => setTimeout(r, 300));

            // Stop if reached target
            if (completedGamesCount >= targetGames) {
              console.log(`\n✅ Reached target of ${targetGames} games!`);
              break;
            }

          } catch (error) {
            console.log(`    ❌ Error: ${(error as Error).message}`);
            // Continue with next game
          }
        }

        // Stop if reached target
        if (completedGamesCount >= targetGames) {
          break;
        }

      } catch (error) {
        console.log(`  ❌ Error fetching date: ${(error as Error).message}`);
      }

      daysBack++;

      // Small delay between dates
      await new Promise(r => setTimeout(r, 200));

      // Print progress every 10 days
      if (daysBack % 10 === 0) {
        const current = await pool.query('SELECT COUNT(*) as count FROM matches');
        console.log(`\n📊 Progress: ${current.rows[0].count} matches in database\n`);
      }
    }

    // Final count
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM matches');
    const statsCount = await pool.query('SELECT COUNT(*) as count FROM player_game_stats');

    console.log('\n===========================================');
    console.log('✅ Backfill Completed!');
    console.log('===========================================');
    console.log(`📊 Total matches: ${finalCount.rows[0].count}`);
    console.log(`📊 Total stats: ${statsCount.rows[0].count}\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  backfillRobust()
    .then(() => {
      console.log('✅ Done! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

export { backfillRobust };
