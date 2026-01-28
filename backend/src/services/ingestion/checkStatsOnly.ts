import pool from '../../config/database';

(async () => {
  try {
    // Check for duplicate stats (same player_id + match_id appearing multiple times)
    const dupeStats = await pool.query(`
      SELECT player_id, match_id, COUNT(*) as count, array_agg(id) as ids
      FROM player_game_stats
      GROUP BY player_id, match_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `);

    console.log(`\nDuplicate stats entries: ${dupeStats.rows.length}`);

    if (dupeStats.rows.length > 0) {
      console.log('\nDuplicate stats (same player + same match):');
      for (const stat of dupeStats.rows) {
        const player = await pool.query(
          'SELECT first_name, last_name FROM players WHERE id = $1',
          [stat.player_id]
        );
        const name = player.rows[0]
          ? `${player.rows[0].first_name} ${player.rows[0].last_name}`
          : `Player ${stat.player_id}`;

        console.log(`  ${name} - Match ${stat.match_id}: ${stat.count} entries (IDs: ${stat.ids.join(', ')})`);
      }
    } else {
      console.log('✅ No duplicate stats entries found!');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
