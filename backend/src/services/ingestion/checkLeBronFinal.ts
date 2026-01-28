import pool from '../../config/database';

(async () => {
  try {
    // Check LeBron's current team
    const lebron = await pool.query(`
      SELECT p.first_name, p.last_name, t.abbreviation as team, COUNT(pgs.id) as games
      FROM players p
      LEFT JOIN teams t ON p.current_team_id = t.id
      LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
      WHERE p.last_name = 'James' AND p.first_name = 'LeBron'
      GROUP BY p.id, p.first_name, p.last_name, t.abbreviation
    `);

    console.log('LeBron James:', lebron.rows[0]);

    // Check hist-* matches
    const histMatches = await pool.query(`
      SELECT COUNT(*) as count FROM matches WHERE nba_game_id LIKE 'hist-%'
    `);
    console.log('Hist matches remaining:', histMatches.rows[0].count);

    // Check total matches and stats
    const matches = await pool.query('SELECT COUNT(*) as count FROM matches');
    console.log('Total matches:', matches.rows[0].count);

    const stats = await pool.query('SELECT COUNT(*) as count FROM player_game_stats');
    console.log('Total player stats:', stats.rows[0].count);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
