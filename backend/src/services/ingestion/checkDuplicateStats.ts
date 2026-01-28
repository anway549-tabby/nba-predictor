import pool from '../../config/database';

(async () => {
  try {
    // Check for duplicate stats (same player + same match)
    const dupeStats = await pool.query(`
      SELECT player_id, match_id, COUNT(*) as count
      FROM player_game_stats
      GROUP BY player_id, match_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `);

    console.log(`\nDuplicate stats entries: ${dupeStats.rows.length}`);
    if (dupeStats.rows.length > 0) {
      console.log('\nTop duplicate stats:');
      for (const stat of dupeStats.rows) {
        // Get player name
        const player = await pool.query(
          'SELECT first_name, last_name FROM players WHERE id = $1',
          [stat.player_id]
        );
        const playerName = player.rows[0]
          ? `${player.rows[0].first_name} ${player.rows[0].last_name}`
          : `Player ID ${stat.player_id}`;

        console.log(`  ${playerName} - Match ${stat.match_id}: ${stat.count} entries`);
      }
    }

    // Check specifically for the conflicting players
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Checking duplicate player entries:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const dupes = await pool.query(`
      SELECT first_name, last_name, array_agg(id) as ids
      FROM players
      GROUP BY first_name, last_name
      HAVING COUNT(*) > 1
    `);

    for (const dup of dupes.rows) {
      console.log(`${dup.first_name} ${dup.last_name} (IDs: ${dup.ids.join(', ')}):`);

      // Check if both entries have overlapping matches
      const overlaps = await pool.query(`
        SELECT COUNT(DISTINCT match_id) as overlapping_matches
        FROM player_game_stats
        WHERE player_id = ANY($1::int[])
        GROUP BY match_id
        HAVING COUNT(DISTINCT player_id) > 1
      `, [dup.ids]);

      console.log(`  Overlapping matches: ${overlaps.rows.length}`);

      // Show which matches overlap
      if (overlaps.rows.length > 0 && overlaps.rows.length <= 5) {
        const overlapDetails = await pool.query(`
          SELECT match_id, array_agg(player_id) as player_ids
          FROM player_game_stats
          WHERE player_id = ANY($1::int[])
          GROUP BY match_id
          HAVING COUNT(DISTINCT player_id) > 1
          LIMIT 5
        `, [dup.ids]);

        overlapDetails.rows.forEach(r => {
          console.log(`    Match ${r.match_id}: players ${r.player_ids.join(', ')}`);
        });
      }
      console.log();
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
