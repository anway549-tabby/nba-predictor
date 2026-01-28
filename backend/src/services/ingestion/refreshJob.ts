/**
 * Data Refresh Job
 *
 * Orchestrates the daily data refresh process:
 * 1. Fetch games for yesterday (completed games)
 * 2. Fetch player stats for those games
 * 3. Save everything to database
 * 4. Log the refresh operation
 *
 * This job should run daily at 12:00 PM IST
 */

import { fetchGames, fetchAllPlayerStats } from './nbaApiClient';
import { saveMatch, savePlayerGameStats, logDataRefresh } from './dataStorage';

/**
 * Main data refresh function
 * Fetches NBA data and saves to database
 */
export async function runDataRefresh(): Promise<void> {
  console.log('\n===========================================');
  console.log('🔄 Starting NBA Data Refresh');
  console.log('===========================================\n');

  const startTime = Date.now();

  try {
    // Step 1: Determine date to fetch (yesterday's games)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`📅 Fetching data for: ${dateStr}\n`);

    // Step 2: Fetch games for yesterday
    console.log('Step 1: Fetching games...');
    const games = await fetchGames(dateStr);

    if (games.length === 0) {
      console.log('ℹ️  No games found for this date');
      await logDataRefresh(dateStr, 'success', 0, 0);
      return;
    }

    console.log(`✓ Found ${games.length} games\n`);

    // Step 3: Save games to database and collect game IDs
    console.log('Step 2: Saving games to database...');
    const matchIds: Map<number, number> = new Map(); // NBA game ID → DB match ID

    for (const game of games) {
      const matchId = await saveMatch(game);
      matchIds.set(game.id, matchId);
      console.log(`  ✓ Saved: ${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation}`);
    }

    console.log(`✓ Saved ${games.length} games\n`);

    // Step 4: Fetch player stats for all games
    console.log('Step 3: Fetching player stats...');
    const allStats = await fetchAllPlayerStats(dateStr);

    if (allStats.length === 0) {
      console.log('⚠️  No player stats found');
      await logDataRefresh(dateStr, 'partial', games.length, 0);
      return;
    }

    console.log(`✓ Found ${allStats.length} player stat records\n`);

    // Step 5: Save player stats to database
    console.log('Step 4: Saving player stats to database...');
    let savedCount = 0;
    let errorCount = 0;

    for (const stat of allStats) {
      try {
        const matchId = matchIds.get(stat.game.id);

        if (matchId) {
          await savePlayerGameStats(stat, matchId);
          savedCount++;

          // Log progress every 50 players
          if (savedCount % 50 === 0) {
            console.log(`  ... saved ${savedCount}/${allStats.length} player stats`);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`  ✗ Error saving stat for player ${stat.player.id}:`, error);
      }
    }

    console.log(`✓ Saved ${savedCount} player stats (${errorCount} errors)\n`);

    // Step 6: Log successful refresh
    await logDataRefresh(
      dateStr,
      errorCount > 0 ? 'partial' : 'success',
      games.length,
      savedCount
    );

    // Calculate execution time
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('===========================================');
    console.log('✅ Data Refresh Completed Successfully');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Games: ${games.length} | Player Stats: ${savedCount}`);
    console.log('===========================================\n');

  } catch (error) {
    console.error('\n❌ Data refresh failed:', error);

    // Log failed refresh
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    await logDataRefresh(
      dateStr,
      'failed',
      0,
      0,
      (error as Error).message
    );

    throw error;
  }
}

/**
 * Fetch data for a specific date (for testing or backfilling)
 * @param date - Date in YYYY-MM-DD format
 */
export async function fetchDataForDate(date: string): Promise<void> {
  console.log(`\n🔄 Fetching data for specific date: ${date}\n`);

  try {
    // Fetch games
    const games = await fetchGames(date);
    console.log(`✓ Found ${games.length} games`);

    // Save games
    const matchIds: Map<number, number> = new Map();
    for (const game of games) {
      const matchId = await saveMatch(game);
      matchIds.set(game.id, matchId);
    }

    // Fetch and save player stats
    const allStats = await fetchAllPlayerStats(date);
    console.log(`✓ Found ${allStats.length} player stats`);

    let savedCount = 0;
    for (const stat of allStats) {
      const matchId = matchIds.get(stat.game.id);
      if (matchId) {
        await savePlayerGameStats(stat, matchId);
        savedCount++;
      }
    }

    console.log(`✓ Saved ${savedCount} player stats`);
    await logDataRefresh(date, 'success', games.length, savedCount);

    console.log(`\n✅ Data fetch completed for ${date}\n`);
  } catch (error) {
    console.error(`\n❌ Data fetch failed for ${date}:`, error);
    await logDataRefresh(date, 'failed', 0, 0, (error as Error).message);
    throw error;
  }
}
