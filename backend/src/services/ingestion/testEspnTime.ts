/**
 * Test ESPN time format
 */

import axios from 'axios';

async function testEspnTime() {
  console.log('\n⏰ Testing ESPN Time Format\n');
  console.log('==========================================\n');

  try {
    // Fetch today's games from ESPN
    const date = '20260129'; // Jan 29, 2026
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', {
      params: { dates: date }
    });

    const games = response.data?.events || [];
    console.log(`Found ${games.length} games for ${date}\n`);

    if (games.length > 0) {
      const game = games[0];
      console.log('Sample game:');
      console.log(`  ID: ${game.id}`);
      console.log(`  Name: ${game.name}`);
      console.log(`  Raw date from ESPN: ${game.date}`);
      console.log('');

      // Parse and display in different timezones
      const espnDate = new Date(game.date);
      console.log('Parsed as Date object:');
      console.log(`  UTC: ${espnDate.toISOString()}`);
      console.log(`  EST: ${espnDate.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true })}`);
      console.log(`  IST: ${espnDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}`);
      console.log('');

      console.log('Analysis:');
      console.log('  ESPN returns times in ISO 8601 format');
      console.log('  The timezone indicator (Z or offset) shows the actual timezone');
      console.log('  When storing to database, use the date string directly');
    } else {
      console.log('No games found for this date');
    }

    console.log('\n==========================================\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

testEspnTime();
