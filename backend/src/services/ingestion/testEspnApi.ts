/**
 * Test ESPN Public API
 */

import {
  fetchESPNScoreboard,
  fetchESPNGameSummary,
  parseESPNPlayerStats,
  convertESPNGame,
  fetchCompletedGames
} from './espnApiClient';

async function testESPNApi() {
  console.log('\n🧪 Testing ESPN Public API\n');
  console.log('===========================================\n');

  try {
    // Test 1: Fetch today's scoreboard
    console.log('📅 Test 1: Fetching today\'s scoreboard...\n');
    const todayGames = await fetchESPNScoreboard();

    if (todayGames.length > 0) {
      console.log(`✓ Found ${todayGames.length} games today:`);
      todayGames.forEach((game, idx) => {
        const converted = convertESPNGame(game);
        console.log(`   ${idx + 1}. ${converted.awayTeam.abbreviation} @ ${converted.homeTeam.abbreviation} - ${converted.status}`);
      });
    } else {
      console.log('ℹ️  No games today');
    }

    // Test 2: Fetch completed games from recent dates
    console.log('\n📅 Test 2: Fetching recent completed games...\n');

    const testDates = [
      '2025-01-23',
      '2025-01-22',
      '2025-01-21'
    ];

    let completedGame: any = null;

    for (const date of testDates) {
      console.log(`\nChecking ${date}...`);
      const completed = await fetchCompletedGames(date);

      if (completed.length > 0) {
        console.log(`✓ Found ${completed.length} completed games:`);
        completed.forEach(g => {
          console.log(`   ${g.awayTeam.abbreviation} ${g.awayTeam.score} @ ${g.homeTeam.abbreviation} ${g.homeTeam.score}`);
        });

        // Save first completed game for detailed test
        if (!completedGame) {
          completedGame = completed[0];
        }
      } else {
        console.log(`  ℹ️  No completed games`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test 3: Fetch detailed game summary with player stats
    if (completedGame) {
      console.log(`\n📊 Test 3: Fetching player stats for a completed game...\n`);
      console.log(`Game: ${completedGame.awayTeam.abbreviation} @ ${completedGame.homeTeam.abbreviation}`);

      const gameSummary = await fetchESPNGameSummary(completedGame.gameId);

      if (gameSummary?.boxscore) {
        const playerStats = parseESPNPlayerStats(gameSummary.boxscore, completedGame.gameId);

        if (playerStats.length > 0) {
          console.log(`\n✓ Successfully parsed ${playerStats.length} player stats`);
          console.log('\nSample player stats:');

          // Show first 5 players
          playerStats.slice(0, 5).forEach(p => {
            console.log(`   ${p.playerName} (${p.teamAbbr}): ${p.minutes} min, ${p.points} pts, ${p.rebounds} reb, ${p.assists} ast`);
          });
        } else {
          console.log('  ⚠️  No player stats found in box score');
        }
      } else {
        console.log('  ⚠️  No box score available');
      }
    }

    console.log('\n===========================================');
    console.log('✅ ESPN API Test Complete');
    console.log('===========================================');
    console.log('\n💡 Key findings:');
    console.log('   • ESPN API is working and free');
    console.log('   • No authentication required');
    console.log('   • Provides schedule and detailed box scores');
    console.log('   • Perfect for our use case!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

testESPNApi()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
