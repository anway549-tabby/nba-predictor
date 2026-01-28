/**
 * Cleanup Duplicate Teams
 *
 * Consolidates duplicate team entries to fix player team assignments
 */

import pool from '../../config/database';

async function cleanupDuplicateTeams() {
  console.log('\n===========================================');
  console.log('🧹 Cleaning Up Duplicate Teams');
  console.log('===========================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get all teams grouped by abbreviation
    const teams = await client.query(`
      SELECT abbreviation, array_agg(id ORDER BY id) as ids
      FROM teams
      GROUP BY abbreviation
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${teams.rows.length} duplicate team abbreviations\n`);

    for (const team of teams.rows) {
      const keepId = team.ids[0]; // Keep the first one
      const removeIds = team.ids.slice(1); // Remove the rest

      console.log(`${team.abbreviation}: Keeping ID ${keepId}, consolidating ${removeIds.join(', ')}`);

      // Update all references to duplicate teams
      for (const removeId of removeIds) {
        // Update players
        const playersResult = await client.query(
          'UPDATE players SET current_team_id = $1 WHERE current_team_id = $2 RETURNING id',
          [keepId, removeId]
        );
        console.log(`  ✓ Updated ${playersResult.rowCount} players`);

        // Update matches (home team)
        const homeResult = await client.query(
          'UPDATE matches SET home_team_id = $1 WHERE home_team_id = $2 RETURNING id',
          [keepId, removeId]
        );
        console.log(`  ✓ Updated ${homeResult.rowCount} home matches`);

        // Update matches (away team)
        const awayResult = await client.query(
          'UPDATE matches SET away_team_id = $1 WHERE away_team_id = $2 RETURNING id',
          [keepId, removeId]
        );
        console.log(`  ✓ Updated ${awayResult.rowCount} away matches`);

        // Update player_game_stats (team_id)
        const statsTeamResult = await client.query(
          'UPDATE player_game_stats SET team_id = $1 WHERE team_id = $2 RETURNING id',
          [keepId, removeId]
        );
        console.log(`  ✓ Updated ${statsTeamResult.rowCount} player stats (team)`);

        // Update player_game_stats (opponent_team_id)
        const statsOppResult = await client.query(
          'UPDATE player_game_stats SET opponent_team_id = $1 WHERE opponent_team_id = $2 RETURNING id',
          [keepId, removeId]
        );
        console.log(`  ✓ Updated ${statsOppResult.rowCount} player stats (opponent)`);

        // Delete the duplicate team
        await client.query('DELETE FROM teams WHERE id = $1', [removeId]);
        console.log(`  ✓ Deleted duplicate team ID ${removeId}\n`);
      }
    }

    await client.query('COMMIT');
    console.log('===========================================');
    console.log('✅ Duplicate Teams Cleaned Up!');
    console.log('===========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error cleaning up duplicates:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  cleanupDuplicateTeams()
    .then(() => {
      console.log('✅ Cleanup completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateTeams };
