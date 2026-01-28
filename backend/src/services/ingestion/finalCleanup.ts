/**
 * Final Cleanup Script
 * - Delete hist-* games and their stats
 * - Update all player team assignments
 */

import pool from '../../config/database';

async function finalCleanup() {
  console.log('Starting final cleanup...\n');

  const client = await pool.connect();

  try {
    // Step 1: Delete hist game stats
    console.log('Step 1: Deleting hist-* game stats...');
    const deleteStats = await client.query(`
      DELETE FROM player_game_stats
      WHERE match_id IN (
        SELECT id FROM matches WHERE nba_game_id LIKE 'hist-%'
      )
    `);
    console.log(`✓ Deleted ${deleteStats.rowCount} hist game stats\n`);

    // Step 2: Delete hist matches
    console.log('Step 2: Deleting hist-* matches...');
    const deleteMatches = await client.query(`
      DELETE FROM matches WHERE nba_game_id LIKE 'hist-%'
    `);
    console.log(`✓ Deleted ${deleteMatches.rowCount} hist matches\n`);

    // Step 3: Update player team assignments
    console.log('Step 3: Updating player team assignments...');
    const updatePlayers = await client.query(`
      UPDATE players p
      SET current_team_id = (
        SELECT team_id
        FROM player_game_stats
        WHERE player_id = p.id
        ORDER BY game_date DESC, id DESC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM player_game_stats WHERE player_id = p.id
      )
    `);
    console.log(`✓ Updated ${updatePlayers.rowCount} players\n`);

    // Step 4: Verify LeBron
    console.log('Step 4: Verifying LeBron James...');
    const lebronCheck = await client.query(`
      SELECT p.first_name, p.last_name, t.abbreviation as team
      FROM players p
      LEFT JOIN teams t ON p.current_team_id = t.id
      WHERE p.first_name = 'LeBron' AND p.last_name = 'James'
    `);

    if (lebronCheck.rows.length > 0) {
      console.log(`✓ LeBron James team: ${lebronCheck.rows[0].team}`);
    }

    console.log('\n✅ Cleanup completed!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  finalCleanup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { finalCleanup };
