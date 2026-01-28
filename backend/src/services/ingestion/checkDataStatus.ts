/**
 * Check current data status in the database
 */

import pool from '../../config/database';

async function checkDataStatus() {
  try {
    // Check matches by status
    const matches = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM matches
      GROUP BY status
      ORDER BY status
    `);

    console.log('\n📊 DATABASE STATUS\n');
    console.log('==========================================\n');
    console.log('Matches by status:');
    matches.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count} games`);
    });

    // Check total stats
    const stats = await pool.query('SELECT COUNT(*) as total FROM player_game_stats');
    console.log(`\nTotal player stats: ${stats.rows[0].total}`);

    // Check unique players
    const players = await pool.query('SELECT COUNT(DISTINCT player_id) as count FROM player_game_stats');
    console.log(`Unique players with stats: ${players.rows[0].count}`);

    // Check players with 15+ games (eligible for predictions)
    const eligible = await pool.query(`
      SELECT COUNT(*) as eligible_players
      FROM (
        SELECT player_id, COUNT(*) as games
        FROM player_game_stats
        GROUP BY player_id
        HAVING COUNT(*) >= 15
      ) as subq
    `);
    console.log(`\nPlayers with 15+ games (eligible for predictions): ${eligible.rows[0].eligible_players}`);

    // Check top 10 players by game count
    const top = await pool.query(`
      SELECT p.first_name, p.last_name, t.abbreviation, COUNT(pgs.id) as games
      FROM players p
      JOIN teams t ON p.current_team_id = t.id
      JOIN player_game_stats pgs ON p.id = pgs.player_id
      GROUP BY p.id, p.first_name, p.last_name, t.abbreviation
      ORDER BY games DESC
      LIMIT 10
    `);

    console.log('\nTop 10 players by game count:');
    top.rows.forEach(row => {
      console.log(`  ${row.first_name} ${row.last_name} (${row.abbreviation}): ${row.games} games`);
    });

    // Check date range of games
    const dateRange = await pool.query(`
      SELECT
        MIN(game_date) as earliest,
        MAX(game_date) as latest
      FROM matches
      WHERE status IN ('completed', 'final')
    `);

    console.log(`\nDate range of completed games:`);
    console.log(`  Earliest: ${dateRange.rows[0].earliest}`);
    console.log(`  Latest: ${dateRange.rows[0].latest}`);

    console.log('\n==========================================\n');

    await pool.end();
  } catch (error) {
    console.error('Error checking status:', error);
    process.exit(1);
  }
}

checkDataStatus();
