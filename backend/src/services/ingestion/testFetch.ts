/**
 * Test script for NBA data fetching
 *
 * Run this to test fetching real NBA data and saving to database
 * Usage: npx ts-node src/services/ingestion/testFetch.ts
 */

import { runDataRefresh, fetchDataForDate } from './refreshJob';

// Test fetching data for a specific date
// Note: NBA 2025-26 season is currently active (started October 2025)
// Let's try multiple dates to see what data is available
const TEST_DATES = [
  '2026-01-20',  // Recent game from current season
  '2026-01-15',  // Week ago
  '2025-12-25',  // Christmas games (popular date)
  '2025-11-01',  // Early season
  '2025-01-22',  // Last year's game (2024-25 season)
];

const TEST_DATE = TEST_DATES[4]; // Start with last year's data that we know exists

async function main() {
  try {
    console.log('🏀 NBA Data Fetch Test\n');
    console.log('Options:');
    console.log('1. Fetch yesterday\'s games (automatic)');
    console.log('2. Fetch specific date\n');

    // Option 1: Fetch yesterday's data (simulates daily refresh)
    // console.log('Running Option 1: Fetching yesterday\'s games...\n');
    // await runDataRefresh();

    // Option 2: Fetch specific date (use this to avoid system clock issues)
    console.log(`Running Option 2: Fetching data for ${TEST_DATE}...\n`);
    await fetchDataForDate(TEST_DATE);

    console.log('\n✅ Test completed successfully!');
    console.log('\nCheck pgAdmin to verify data was saved:');
    console.log('  - Open pgAdmin');
    console.log('  - Navigate to nba_predictor database');
    console.log('  - Right-click nba_predictor → Query Tool');
    console.log('  - Run: SELECT * FROM matches;');
    console.log('  - Run: SELECT * FROM player_game_stats LIMIT 100;');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
