import pool from '../../config/database';

(async () => {
  try {
    const matches = await pool.query('SELECT COUNT(*) as count FROM matches');
    const stats = await pool.query('SELECT COUNT(*) as count FROM player_game_stats');
    const histMatches = await pool.query("SELECT COUNT(*) as count FROM matches WHERE nba_game_id LIKE 'hist-%'");

    const players15Plus = await pool.query(`
      SELECT COUNT(DISTINCT player_id) as count
      FROM (
        SELECT player_id, COUNT(*) as games
        FROM player_game_stats
        GROUP BY player_id
        HAVING COUNT(*) >= 15
      ) subquery
    `);

    console.log('Current Status:');
    console.log('  Total matches:', matches.rows[0].count);
    console.log('  Total player stats:', stats.rows[0].count);
    console.log('  Hist matches (to clean):', histMatches.rows[0].count);
    console.log('  Players with 15+ games:', players15Plus.rows[0].count);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
