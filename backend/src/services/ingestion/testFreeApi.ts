/**
 * Test Free NBA API with known dates
 */

import { fetchScheduleForDate, fetchPlayerStatsForGame } from './freeNbaClient';

async function testFreeNbaApi() {
  console.log('\n🧪 Testing Free NBA.com API\n');
  console.log('===========================================\n');

  // Test with a known date in the past (NBA season 2024-25)
  const testDates = [
    '2025-01-23',  // Recent date
    '2025-01-22',  // Day before
    '2025-01-21',  // 2 days before
    '2024-12-25',  // Christmas games (always has games)
    '2024-11-15'   // Mid-season
  ];

  for (const date of testDates) {
    console.log(`\n📅 Testing ${date}...`);
    try {
      const games = await fetchScheduleForDate(date);

      if (games.length === 0) {
        console.log(`  ℹ️  No games found`);
      } else {
        console.log(`  ✓ Found ${games.length} games`);
        games.forEach(g => {
          console.log(`     ${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation} (${g.status})`);
        });

        // Test fetching player stats for first game if it's completed
        const completedGame = games.find(g => g.status === 'final');
        if (completedGame) {
          console.log(`\n  📊 Testing player stats for game ${completedGame.gameId}...`);
          try {
            const stats = await fetchPlayerStatsForGame(completedGame.gameId);
            console.log(`  ✓ Found ${stats.length} player stats`);
            if (stats.length > 0) {
              console.log(`     Sample: ${stats[0].playerName} - ${stats[0].points} pts, ${stats[0].rebounds} reb, ${stats[0].assists} ast`);
            }
          } catch (error) {
            console.error(`  ✗ Error fetching player stats:`, (error as Error).message);
          }
        }
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  ✗ Error:`, (error as Error).message);
    }
  }

  console.log('\n===========================================');
  console.log('✅ API Test Complete\n');
}

testFreeNbaApi()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
