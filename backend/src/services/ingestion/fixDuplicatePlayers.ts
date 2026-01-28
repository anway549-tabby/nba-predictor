/**
 * Fix Duplicate Players
 *
 * For duplicate players:
 * 1. Keep the player with more games
 * 2. Delete stats from the old player (don't move, since they overlap)
 * 3. Delete the old player entry
 */

import pool from '../../config/database';

async function fixDuplicatePlayers() {
  console.log('\n===========================================');
  console.log('🔧 Fixing Duplicate Players');
  console.log('===========================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find all duplicate players
    const dupes = await client.query(`
      SELECT first_name, last_name, array_agg(id ORDER BY id) as ids
      FROM players
      GROUP BY first_name, last_name
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${dupes.rows.length} duplicate player names\n`);

    for (const dup of dupes.rows) {
      const playerName = `${dup.first_name} ${dup.last_name}`;
      console.log(`Processing: ${playerName}`);

      // Get stats count for each entry
      const statsPerEntry = [];
      for (const id of dup.ids) {
        const stats = await client.query(
          'SELECT COUNT(*) as count FROM player_game_stats WHERE player_id = $1',
          [id]
        );
        statsPerEntry.push({ id, count: parseInt(stats.rows[0].count) });
      }

      // Keep the entry with the most stats
      statsPerEntry.sort((a, b) => b.count - a.count);
      const keepId = statsPerEntry[0].id;
      const removeIds = statsPerEntry.slice(1).map(e => e.id);

      console.log(`  ✓ Keeping ID ${keepId} (${statsPerEntry[0].count} games)`);
      console.log(`  ✗ Removing IDs: ${removeIds.join(', ')}`);

      for (const removeId of removeIds) {
        const statsCount = statsPerEntry.find(e => e.id === removeId)?.count || 0;

        // Delete stats from old player (don't move, they overlap)
        const deletedStats = await client.query(
          'DELETE FROM player_game_stats WHERE player_id = $1',
          [removeId]
        );
        console.log(`    - Deleted ${deletedStats.rowCount} stats from ID ${removeId}`);

        // Delete predictions from old player
        const deletedPreds = await client.query(
          'DELETE FROM predictions WHERE player_id = $1',
          [removeId]
        );
        if (deletedPreds.rowCount && deletedPreds.rowCount > 0) {
          console.log(`    - Deleted ${deletedPreds.rowCount} predictions from ID ${removeId}`);
        }

        // Delete the duplicate player
        await client.query('DELETE FROM players WHERE id = $1', [removeId]);
        console.log(`    - Deleted player ID ${removeId}`);
      }

      console.log();
    }

    // Update player teams based on most recent game
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Updating player team assignments...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const updateResult = await client.query(`
      UPDATE players p
      SET current_team_id = (
        SELECT pgs.team_id
        FROM player_game_stats pgs
        WHERE pgs.player_id = p.id
        ORDER BY pgs.game_date DESC, pgs.id DESC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM player_game_stats WHERE player_id = p.id
      )
    `);

    console.log(`✓ Updated ${updateResult.rowCount} player team assignments\n`);

    await client.query('COMMIT');

    console.log('===========================================');
    console.log('✅ Duplicate Players Fixed!');
    console.log('===========================================\n');

    // Verify results
    const remaining = await client.query(`
      SELECT first_name, last_name, COUNT(*) as count
      FROM players
      GROUP BY first_name, last_name
      HAVING COUNT(*) > 1
    `);

    if (remaining.rows.length === 0) {
      console.log('✅ No duplicate players remaining\n');
    } else {
      console.log(`⚠️  Still ${remaining.rows.length} duplicate players remaining\n`);
    }

    // Check LeBron
    const lebron = await client.query(`
      SELECT p.id, p.first_name, p.last_name, t.abbreviation as team, COUNT(pgs.id) as games
      FROM players p
      LEFT JOIN teams t ON p.current_team_id = t.id
      LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
      WHERE p.first_name = 'LeBron' AND p.last_name = 'James'
      GROUP BY p.id, p.first_name, p.last_name, t.abbreviation
    `);

    console.log('LeBron James:');
    lebron.rows.forEach(r => {
      console.log(`  ID: ${r.id} | Team: ${r.team} | Games: ${r.games}`);
    });
    console.log();

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  fixDuplicatePlayers()
    .then(() => {
      console.log('✅ Script completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { fixDuplicatePlayers };
