/**
 * Generate Sample NBA Data
 *
 * Creates realistic sample data for testing when the API is unavailable
 * This creates data for Lakers vs Warriors game on 2025-01-22
 */

import pool from '../../config/database';

async function generateSampleData() {
  console.log('\n🏀 Generating Sample NBA Data...\n');

  try {
    // Step 1: Create Teams
    console.log('Creating teams...');

    const lakersResult = await pool.query(
      `INSERT INTO teams (nba_team_id, name, abbreviation)
       VALUES (13, 'Los Angeles Lakers', 'LAL')
       ON CONFLICT (nba_team_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const lakersId = lakersResult.rows[0].id;

    const warriorsResult = await pool.query(
      `INSERT INTO teams (nba_team_id, name, abbreviation)
       VALUES (10, 'Golden State Warriors', 'GSW')
       ON CONFLICT (nba_team_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const warriorsId = warriorsResult.rows[0].id;

    console.log(`✓ Created Lakers (ID: ${lakersId})`);
    console.log(`✓ Created Warriors (ID: ${warriorsId})\n`);

    // Step 2: Create Match
    console.log('Creating match...');

    const matchResult = await pool.query(
      `INSERT INTO matches (nba_game_id, game_date, game_time, home_team_id, away_team_id, season, status)
       VALUES ('sample-001', '2025-01-22', '2025-01-22 19:30:00', $1, $2, '2024-25', 'completed')
       ON CONFLICT (nba_game_id) DO UPDATE SET status = 'completed'
       RETURNING id`,
      [lakersId, warriorsId]
    );
    const matchId = matchResult.rows[0].id;

    console.log(`✓ Created match: GSW @ LAL (ID: ${matchId})\n`);

    // Step 3: Create Players
    console.log('Creating players...');

    // LeBron James
    const lebronResult = await pool.query(
      `INSERT INTO players (nba_player_id, first_name, last_name, current_team_id, position)
       VALUES (237, 'LeBron', 'James', $1, 'F')
       ON CONFLICT (nba_player_id) DO UPDATE SET current_team_id = $1
       RETURNING id`,
      [lakersId]
    );
    const lebronId = lebronResult.rows[0].id;

    // Anthony Davis
    const adResult = await pool.query(
      `INSERT INTO players (nba_player_id, first_name, last_name, current_team_id, position)
       VALUES (115, 'Anthony', 'Davis', $1, 'F-C')
       ON CONFLICT (nba_player_id) DO UPDATE SET current_team_id = $1
       RETURNING id`,
      [lakersId]
    );
    const adId = adResult.rows[0].id;

    // Stephen Curry
    const curryResult = await pool.query(
      `INSERT INTO players (nba_player_id, first_name, last_name, current_team_id, position)
       VALUES (115, 'Stephen', 'Curry', $1, 'G')
       ON CONFLICT (nba_player_id) DO UPDATE SET current_team_id = $1
       RETURNING id`,
      [warriorsId]
    );
    const curryId = curryResult.rows[0].id;

    console.log(`✓ Created LeBron James (ID: ${lebronId})`);
    console.log(`✓ Created Anthony Davis (ID: ${adId})`);
    console.log(`✓ Created Stephen Curry (ID: ${curryId})\n`);

    // Step 4: Create Player Stats (Last 15 games for each player)
    console.log('Creating player game stats (15 games per player)...');

    // LeBron's last 15 games
    const lebronStats = [
      { date: '2025-01-22', opp: warriorsId, min: 35, pts: 28, reb: 8, ast: 11 },
      { date: '2025-01-20', opp: warriorsId, min: 34, pts: 26, reb: 7, ast: 9 },
      { date: '2025-01-18', opp: warriorsId, min: 36, pts: 31, reb: 9, ast: 8 },
      { date: '2025-01-16', opp: warriorsId, min: 33, pts: 25, reb: 6, ast: 10 },
      { date: '2025-01-14', opp: warriorsId, min: 35, pts: 27, reb: 8, ast: 7 },
      { date: '2025-01-12', opp: warriorsId, min: 0, pts: 0, reb: 0, ast: 0 },   // DNP
      { date: '2025-01-10', opp: warriorsId, min: 34, pts: 29, reb: 7, ast: 9 },
      { date: '2025-01-08', opp: warriorsId, min: 36, pts: 32, reb: 10, ast: 8 },
      { date: '2025-01-06', opp: warriorsId, min: 35, pts: 26, reb: 8, ast: 11 },
      { date: '2025-01-04', opp: warriorsId, min: 33, pts: 24, reb: 6, ast: 7 },
      { date: '2025-01-02', opp: warriorsId, min: 34, pts: 30, reb: 9, ast: 10 },
      { date: '2024-12-30', opp: warriorsId, min: 36, pts: 28, reb: 7, ast: 8 },
      { date: '2024-12-28', opp: warriorsId, min: 35, pts: 27, reb: 8, ast: 9 },
      { date: '2024-12-26', opp: warriorsId, min: 34, pts: 26, reb: 6, ast: 7 },
      { date: '2024-12-24', opp: warriorsId, min: 33, pts: 25, reb: 7, ast: 8 },
    ];

    for (const stat of lebronStats) {
      await pool.query(
        `INSERT INTO player_game_stats
         (player_id, match_id, team_id, game_date, opponent_team_id, minutes_played, points, rebounds, assists, is_imputed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (player_id, match_id) DO NOTHING`,
        [lebronId, matchId, lakersId, stat.date, stat.opp, stat.min, stat.pts, stat.reb, stat.ast, stat.min === 0]
      );
    }

    console.log(`✓ Created 15 games for LeBron James`);

    // Anthony Davis's last 15 games
    const adStats = [
      { date: '2025-01-22', opp: warriorsId, min: 36, pts: 32, reb: 12, ast: 4 },
      { date: '2025-01-20', opp: warriorsId, min: 35, pts: 30, reb: 11, ast: 3 },
      { date: '2025-01-18', opp: warriorsId, min: 37, pts: 28, reb: 13, ast: 5 },
      { date: '2025-01-16', opp: warriorsId, min: 34, pts: 26, reb: 10, ast: 4 },
      { date: '2025-01-14', opp: warriorsId, min: 36, pts: 31, reb: 12, ast: 3 },
      { date: '2025-01-12', opp: warriorsId, min: 35, pts: 29, reb: 11, ast: 4 },
      { date: '2025-01-10', opp: warriorsId, min: 34, pts: 27, reb: 10, ast: 5 },
      { date: '2025-01-08', opp: warriorsId, min: 36, pts: 33, reb: 14, ast: 4 },
      { date: '2025-01-06', opp: warriorsId, min: 35, pts: 30, reb: 12, ast: 3 },
      { date: '2025-01-04', opp: warriorsId, min: 33, pts: 28, reb: 9, ast: 4 },
      { date: '2025-01-02', opp: warriorsId, min: 34, pts: 31, reb: 11, ast: 5 },
      { date: '2024-12-30', opp: warriorsId, min: 36, pts: 29, reb: 13, ast: 4 },
      { date: '2024-12-28', opp: warriorsId, min: 35, pts: 27, reb: 10, ast: 3 },
      { date: '2024-12-26', opp: warriorsId, min: 34, pts: 30, reb: 12, ast: 4 },
      { date: '2024-12-24', opp: warriorsId, min: 33, pts: 26, reb: 11, ast: 5 },
    ];

    for (const stat of adStats) {
      await pool.query(
        `INSERT INTO player_game_stats
         (player_id, match_id, team_id, game_date, opponent_team_id, minutes_played, points, rebounds, assists, is_imputed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
         ON CONFLICT (player_id, match_id) DO NOTHING`,
        [adId, matchId, lakersId, stat.date, stat.opp, stat.min, stat.pts, stat.reb, stat.ast]
      );
    }

    console.log(`✓ Created 15 games for Anthony Davis\n`);

    console.log('===========================================');
    console.log('✅ Sample Data Generated Successfully!');
    console.log('===========================================');
    console.log('\n📊 Summary:');
    console.log('  - 2 Teams (Lakers, Warriors)');
    console.log('  - 1 Match (GSW @ LAL on 2025-01-22)');
    console.log('  - 3 Players (LeBron, AD, Curry)');
    console.log('  - 30 Player Game Stats');
    console.log('\n✅ You can now test the system!');
    console.log('\nNext Steps:');
    console.log('1. View data in pgAdmin: SELECT * FROM matches;');
    console.log('2. Test API: http://localhost:3001/api/matches?date=2025-01-22');
    console.log('3. Get predictions: http://localhost:3001/api/predictions/' + matchId);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating sample data:', error);
    process.exit(1);
  }
}

generateSampleData();
