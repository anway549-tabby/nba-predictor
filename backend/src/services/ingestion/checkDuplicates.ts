import pool from '../../config/database';

(async () => {
  try {
    // Check LeBron James specifically
    const lebron = await pool.query(`
      SELECT p.id, p.first_name, p.last_name, p.nba_player_id, t.abbreviation as team
      FROM players p
      LEFT JOIN teams t ON p.current_team_id = t.id
      WHERE p.first_name = 'LeBron' AND p.last_name = 'James'
      ORDER BY p.id
    `);

    console.log('LeBron James entries:');
    lebron.rows.forEach(r => {
      console.log(`  ID: ${r.id} | NBA ID: ${r.nba_player_id} | Team: ${r.team}`);
    });

    // Check for all duplicate players
    const dupes = await pool.query(`
      SELECT first_name, last_name, COUNT(*) as count, array_agg(id) as ids
      FROM players
      GROUP BY first_name, last_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    console.log(`\nTotal duplicate player names: ${dupes.rowCount || 0}`);
    if (dupes.rows.length > 0) {
      console.log('\nAll duplicate players:');
      dupes.rows.forEach(r => {
        console.log(`  ${r.first_name} ${r.last_name} - ${r.count} entries (IDs: ${r.ids.join(', ')})`);
      });
    }

    // Check stats for LeBron entries
    if (lebron.rows.length > 1) {
      console.log('\nStats count for each LeBron entry:');
      for (const player of lebron.rows) {
        const stats = await pool.query(
          'SELECT COUNT(*) as count FROM player_game_stats WHERE player_id = $1',
          [player.id]
        );
        console.log(`  ID ${player.id}: ${stats.rows[0].count} games`);
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
