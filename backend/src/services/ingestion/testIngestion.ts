/**
 * Test full data ingestion pipeline
 * Fetches games and player stats for a specific date and saves to database
 */

import { fetchGames, fetchAllPlayerStats } from './nbaApiClient';
import { saveMatch, savePlayerGameStats } from './dataStorage';

async function testIngestion() {
  console.log('\n🏀 Testing Data Ingestion Pipeline...\n');

  try {
    // Use January 22, 2025 (during 2025-26 season)
    const testDate = '2025-01-22';

    console.log(`📅 Fetching data for ${testDate}...`);

    // Step 1: Fetch games
    console.log('\n1️⃣ Fetching games...');
    const games = await fetchGames(testDate);
    console.log(`✓ Found ${games.length} games\n`);

    if (games.length === 0) {
      console.log('⚠️ No games found for this date. Try a different date.');
      return;
    }

    // Display games
    games.forEach((game, idx) => {
      console.log(`   Game ${idx + 1}: ${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation}`);
    });

    // Step 2: Save games to database
    console.log('\n2️⃣ Saving games to database...');
    const matchIds: number[] = [];

    for (const game of games) {
      const matchId = await saveMatch(game);
      matchIds.push(matchId);
      console.log(`   ✓ Saved: ${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation} (Match ID: ${matchId})`);
    }

    // Step 3: Fetch all player stats for this date
    console.log('\n3️⃣ Fetching player stats...');
    const allStats = await fetchAllPlayerStats(testDate);
    console.log(`✓ Found ${allStats.length} player stats\n`);

    // Step 4: Save player stats
    console.log('4️⃣ Saving player stats to database...');
    let savedCount = 0;

    for (const stat of allStats) {
      // Find the matching match ID
      const game = games.find(g => g.id === stat.game.id);
      if (game) {
        const matchId = matchIds[games.indexOf(game)];
        await savePlayerGameStats(stat, matchId);
        savedCount++;

        if (savedCount % 10 === 0) {
          process.stdout.write(`   Saved ${savedCount}/${allStats.length}...\r`);
        }
      }
    }

    console.log(`   ✓ Saved ${savedCount} player stats                    \n`);

    console.log('\n===========================================');
    console.log('✅ Data Ingestion Test Completed!');
    console.log('===========================================');
    console.log(`\n📊 Summary:`);
    console.log(`   - Date: ${testDate}`);
    console.log(`   - Games saved: ${games.length}`);
    console.log(`   - Player stats saved: ${savedCount}`);
    console.log('\n✅ You can now test the API endpoints!');
    console.log(`   - Matches: http://localhost:3001/api/matches?date=${testDate}`);
    console.log(`   - Predictions: http://localhost:3001/api/predictions/{matchId}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during ingestion:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

testIngestion();
