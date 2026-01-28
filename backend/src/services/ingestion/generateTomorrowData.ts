/**
 * Generate Sample NBA Data for Tomorrow
 *
 * Creates realistic sample data for testing predictions
 * Uses tomorrow's date to ensure predictions are available
 */

import pool from '../../config/database';

async function generateTomorrowData() {
  console.log('\n🏀 Generating Sample NBA Data for Tomorrow...\n');

  try {
    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
    const gameTime = new Date(tomorrow);
    gameTime.setHours(19, 30, 0, 0); // 7:30 PM

    console.log(`📅 Game Date: ${tomorrowStr}`);
    console.log(`⏰ Game Time: ${gameTime.toISOString()}\n`);

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

    // Step 2: Create Match for tomorrow
    console.log('Creating match for tomorrow...');

    const matchResult = await pool.query(
      `INSERT INTO matches (nba_game_id, game_date, game_time, home_team_id, away_team_id, season, status)
       VALUES ('sample-tomorrow', $1, $2, $3, $4, '2025-26', 'scheduled')
       ON CONFLICT (nba_game_id) DO UPDATE SET
         game_date = EXCLUDED.game_date,
         game_time = EXCLUDED.game_time,
         status = EXCLUDED.status
       RETURNING id`,
      [tomorrowStr, gameTime.toISOString(), lakersId, warriorsId]
    );
    const matchId = matchResult.rows[0].id;

    console.log(`✓ Created match: GSW @ LAL (ID: ${matchId})`);
    console.log(`   Date: ${tomorrowStr} at 7:30 PM\n`);

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
       VALUES (666, 'Stephen', 'Curry', $1, 'G')
       ON CONFLICT (nba_player_id) DO UPDATE SET current_team_id = $1
       RETURNING id`,
      [warriorsId]
    );
    const curryId = curryResult.rows[0].id;

    console.log(`✓ Created LeBron James (ID: ${lebronId})`);
    console.log(`✓ Created Anthony Davis (ID: ${adId})`);
    console.log(`✓ Created Stephen Curry (ID: ${curryId})\n`);

    // Step 4: Delete old stats and create new ones
    console.log('Creating player game stats (15 games per player)...');

    // Clear old stats for these players
    await pool.query(`DELETE FROM player_game_stats WHERE player_id IN ($1, $2, $3)`, [lebronId, adId, curryId]);

    // LeBron's last 15 games (averaging 27 pts, 8 reb, 8 ast)
    const lebronStats = [
      { date: -1, min: 35, pts: 28, reb: 8, ast: 11 },   // Yesterday
      { date: -3, min: 34, pts: 26, reb: 7, ast: 9 },
      { date: -5, min: 36, pts: 31, reb: 9, ast: 8 },
      { date: -7, min: 33, pts: 25, reb: 6, ast: 10 },
      { date: -9, min: 35, pts: 27, reb: 8, ast: 7 },
      { date: -11, min: 0, pts: 0, reb: 0, ast: 0 },     // DNP (will be imputed)
      { date: -13, min: 34, pts: 29, reb: 7, ast: 9 },
      { date: -15, min: 36, pts: 32, reb: 10, ast: 8 },
      { date: -17, min: 35, pts: 26, reb: 8, ast: 11 },
      { date: -19, min: 33, pts: 24, reb: 6, ast: 7 },
      { date: -21, min: 34, pts: 30, reb: 9, ast: 10 },
      { date: -23, min: 36, pts: 28, reb: 7, ast: 8 },
      { date: -25, min: 35, pts: 27, reb: 8, ast: 9 },
      { date: -27, min: 34, pts: 26, reb: 6, ast: 7 },
      { date: -29, min: 33, pts: 25, reb: 7, ast: 8 },
    ];

    for (let i = 0; i < lebronStats.length; i++) {
      const stat = lebronStats[i];
      const gameDate = new Date();
      gameDate.setDate(gameDate.getDate() + stat.date);
      const gameDateStr = gameDate.toISOString().split('T')[0];

      // Create a historical match for this game
      const historicalMatch = await pool.query(
        `INSERT INTO matches (nba_game_id, game_date, game_time, home_team_id, away_team_id, season, status)
         VALUES ($1, $2, $3, $4, $5, '2025-26', 'completed')
         ON CONFLICT (nba_game_id) DO UPDATE SET game_date = EXCLUDED.game_date
         RETURNING id`,
        [`hist-lal-${i}`, gameDateStr, gameDateStr, lakersId, warriorsId]
      );
      const histMatchId = historicalMatch.rows[0].id;

      await pool.query(
        `INSERT INTO player_game_stats
         (player_id, match_id, team_id, game_date, opponent_team_id, minutes_played, points, rebounds, assists, is_imputed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (player_id, match_id) DO NOTHING`,
        [lebronId, histMatchId, lakersId, gameDateStr, warriorsId, stat.min, stat.pts, stat.reb, stat.ast, stat.min === 0]
      );
    }

    console.log(`✓ Created 15 games for LeBron James`);

    // Anthony Davis's last 15 games (averaging 29 pts, 11 reb, 4 ast)
    const adStats = [
      { date: -1, min: 36, pts: 32, reb: 12, ast: 4 },
      { date: -3, min: 35, pts: 30, reb: 11, ast: 3 },
      { date: -5, min: 37, pts: 28, reb: 13, ast: 5 },
      { date: -7, min: 34, pts: 26, reb: 10, ast: 4 },
      { date: -9, min: 36, pts: 31, reb: 12, ast: 3 },
      { date: -11, min: 35, pts: 29, reb: 11, ast: 4 },
      { date: -13, min: 34, pts: 27, reb: 10, ast: 5 },
      { date: -15, min: 36, pts: 33, reb: 14, ast: 4 },
      { date: -17, min: 35, pts: 30, reb: 12, ast: 3 },
      { date: -19, min: 33, pts: 28, reb: 9, ast: 4 },
      { date: -21, min: 34, pts: 31, reb: 11, ast: 5 },
      { date: -23, min: 36, pts: 29, reb: 13, ast: 4 },
      { date: -25, min: 35, pts: 27, reb: 10, ast: 3 },
      { date: -27, min: 34, pts: 30, reb: 12, ast: 4 },
      { date: -29, min: 33, pts: 26, reb: 11, ast: 5 },
    ];

    for (let i = 0; i < adStats.length; i++) {
      const stat = adStats[i];
      const gameDate = new Date();
      gameDate.setDate(gameDate.getDate() + stat.date);
      const gameDateStr = gameDate.toISOString().split('T')[0];

      // Reuse the same historical matches created for LeBron
      const historicalMatch = await pool.query(
        `SELECT id FROM matches WHERE nba_game_id = $1`,
        [`hist-lal-${i}`]
      );
      const histMatchId = historicalMatch.rows[0].id;

      await pool.query(
        `INSERT INTO player_game_stats
         (player_id, match_id, team_id, game_date, opponent_team_id, minutes_played, points, rebounds, assists, is_imputed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
         ON CONFLICT (player_id, match_id) DO NOTHING`,
        [adId, histMatchId, lakersId, gameDateStr, warriorsId, stat.min, stat.pts, stat.reb, stat.ast]
      );
    }

    console.log(`✓ Created 15 games for Anthony Davis`);

    // Stephen Curry's last 15 games (averaging 26 pts, 5 reb, 6 ast)
    const curryStats = [
      { date: -1, min: 34, pts: 28, reb: 5, ast: 7 },
      { date: -3, min: 35, pts: 24, reb: 4, ast: 6 },
      { date: -5, min: 36, pts: 30, reb: 6, ast: 8 },
      { date: -7, min: 33, pts: 22, reb: 5, ast: 5 },
      { date: -9, min: 34, pts: 26, reb: 4, ast: 6 },
      { date: -11, min: 35, pts: 27, reb: 5, ast: 7 },
      { date: -13, min: 36, pts: 29, reb: 6, ast: 6 },
      { date: -15, min: 34, pts: 25, reb: 4, ast: 5 },
      { date: -17, min: 33, pts: 23, reb: 5, ast: 6 },
      { date: -19, min: 35, pts: 28, reb: 6, ast: 8 },
      { date: -21, min: 34, pts: 26, reb: 4, ast: 6 },
      { date: -23, min: 36, pts: 31, reb: 5, ast: 7 },
      { date: -25, min: 35, pts: 24, reb: 4, ast: 5 },
      { date: -27, min: 34, pts: 27, reb: 5, ast: 6 },
      { date: -29, min: 33, pts: 25, reb: 6, ast: 7 },
    ];

    for (let i = 0; i < curryStats.length; i++) {
      const stat = curryStats[i];
      const gameDate = new Date();
      gameDate.setDate(gameDate.getDate() + stat.date);
      const gameDateStr = gameDate.toISOString().split('T')[0];

      // Create historical matches for Warriors games
      const historicalMatch = await pool.query(
        `INSERT INTO matches (nba_game_id, game_date, game_time, home_team_id, away_team_id, season, status)
         VALUES ($1, $2, $3, $4, $5, '2025-26', 'completed')
         ON CONFLICT (nba_game_id) DO UPDATE SET game_date = EXCLUDED.game_date
         RETURNING id`,
        [`hist-gsw-${i}`, gameDateStr, gameDateStr, warriorsId, lakersId]
      );
      const histMatchId = historicalMatch.rows[0].id;

      await pool.query(
        `INSERT INTO player_game_stats
         (player_id, match_id, team_id, game_date, opponent_team_id, minutes_played, points, rebounds, assists, is_imputed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
         ON CONFLICT (player_id, match_id) DO NOTHING`,
        [curryId, histMatchId, warriorsId, gameDateStr, lakersId, stat.min, stat.pts, stat.reb, stat.ast]
      );
    }

    console.log(`✓ Created 15 games for Stephen Curry\n`);

    console.log('===========================================');
    console.log('✅ Sample Data Generated Successfully!');
    console.log('===========================================');
    console.log('\n📊 Summary:');
    console.log('  - 2 Teams (Lakers, Warriors)');
    console.log(`  - 1 Match (GSW @ LAL on ${tomorrowStr} at 7:30 PM)`);
    console.log('  - 3 Players (LeBron, AD, Curry)');
    console.log('  - 45 Player Game Stats (15 per player)');
    console.log('\n✅ You can now test the prediction engine!');
    console.log('\nTest Predictions:');
    console.log(`1. Get match: http://localhost:3001/api/matches?date=${tomorrowStr}`);
    console.log(`2. Get predictions: http://localhost:3001/api/predictions/${matchId}`);
    console.log('\n💡 Expected Predictions:');
    console.log('   LeBron: 25+ pts, 6+ reb, 8+ ast (14/15 games)');
    console.log('   AD: 25+ pts, 10+ reb (14/15 games)');
    console.log('   Curry: 25+ pts (14/15 games)');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating sample data:', error);
    process.exit(1);
  }
}

generateTomorrowData();
