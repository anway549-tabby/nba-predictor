/**
 * Re-process Lakers Games
 *
 * Fixes corrupted Lakers/Clippers games by re-processing with fixed team logic
 */

import { fetchCompletedGames, fetchESPNGameSummary, parseESPNPlayerStats } from './espnApiClient';
import { saveESPNGame, saveESPNPlayerStat } from './espnDataStorage';
import pool from '../../config/database';

async function reprocessLakers() {
  console.log('\n===========================================');
  console.log('🏀 Re-processing Lakers Games');
  console.log('===========================================\n');

  try {
    const dates = ['2026-01-22', '2026-01-24'];

    for (const date of dates) {
      console.log(`Processing ${date}...`);
      const games = await fetchCompletedGames(date);
      const lakersGames = games.filter(g =>
        g.homeTeam.abbreviation === 'LAL' || g.awayTeam.abbreviation === 'LAL'
      );

      if (lakersGames.length === 0) {
        console.log('  ℹ️  No Lakers games found\n');
        continue;
      }

      for (const game of lakersGames) {
        console.log(`  ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
        const matchId = await saveESPNGame(game);
        console.log(`  ✓ Saved match ID: ${matchId}`);

        // Get player stats
        const summary = await fetchESPNGameSummary(game.gameId);
        if (summary?.boxscore) {
          const stats = parseESPNPlayerStats(summary.boxscore, game.gameId);
          console.log(`  📊 Found ${stats.length} player stats`);

          for (const stat of stats) {
            await saveESPNPlayerStat(stat, matchId);
          }
          console.log(`  ✓ Saved player stats\n`);
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log('===========================================');
    console.log('✅ Lakers Games Re-processed!');
    console.log('===========================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  reprocessLakers()
    .then(() => {
      console.log('✅ Re-processing completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Re-processing failed:', error);
      process.exit(1);
    });
}

export { reprocessLakers };
