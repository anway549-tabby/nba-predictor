/**
 * Debug ESPN Boxscore structure
 */

import { fetchESPNScoreboard, fetchESPNGameSummary, convertESPNGame } from './espnApiClient';
import * as fs from 'fs';

async function debugBoxscore() {
  console.log('\n🔍 Debugging ESPN Boxscore Structure\n');

  try {
    // Get a completed game from yesterday
    console.log('Finding a completed game...');
    const games = await fetchESPNScoreboard('20250123');
    const completedGames = games.filter(g => g.status.type.completed);

    if (completedGames.length === 0) {
      console.log('No completed games found');
      return;
    }

    const game = completedGames[0];
    const converted = convertESPNGame(game);

    console.log(`\n✓ Found game: ${converted.awayTeam.abbreviation} @ ${converted.homeTeam.abbreviation}`);
    console.log(`  Game ID: ${converted.gameId}\n`);

    // Fetch full game summary
    console.log('Fetching game summary...');
    const summary = await fetchESPNGameSummary(converted.gameId);

    // Save to file for inspection
    const outputFile = 'd:/espn-game-summary.json';
    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));

    console.log(`\n✅ Full game summary saved to: ${outputFile}`);
    console.log('\n📋 Top-level keys in summary:');
    console.log(Object.keys(summary).join(', '));

    if (summary.boxscore) {
      console.log('\n📋 Boxscore structure:');
      console.log('  Keys:', Object.keys(summary.boxscore).join(', '));

      if (summary.boxscore.players) {
        console.log('\n  Players array length:', summary.boxscore.players.length);

        if (summary.boxscore.players.length > 0) {
          const firstTeam = summary.boxscore.players[0];
          console.log('\n  First team structure:');
          console.log('  Keys:', Object.keys(firstTeam).join(', '));

          if (firstTeam.statistics && firstTeam.statistics.length > 0) {
            const firstStat = firstTeam.statistics[0];
            console.log('\n  Statistics structure:');
            console.log('  Keys:', Object.keys(firstStat).join(', '));
            console.log('  Names:', firstStat.names?.join(', '));
            console.log('  Labels:', firstStat.labels?.join(', '));

            if (firstStat.athletes && firstStat.athletes.length > 0) {
              const firstPlayer = firstStat.athletes[0];
              console.log('\n  Sample player:');
              console.log('  Name:', firstPlayer.athlete?.displayName);
              console.log('  Stats:', firstPlayer.stats?.join(' | '));
            }
          }
        }
      }
    }

    console.log('\n✅ Debug complete. Check the JSON file for full structure.\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

debugBoxscore()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
