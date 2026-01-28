/**
 * Fix Duplicate Player Stats
 *
 * Removes duplicate player_game_stats entries where the same player
 * has multiple entries for the same match
 */

import pool from '../../config/database';

async function fixDuplicates() {
  console.log('\n===========================================');
  console.log('🔧 Fixing Duplicate Player Stats');
  console.log('===========================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find duplicate player stats (same player_id + match_id)
    console.log('Finding duplicate player stats...');
    const duplicates = await client.query(`
      SELECT player_id, match_id, COUNT(*) as cnt
      FROM player_game_stats
      GROUP BY player_id, match_id
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${duplicates.rows.length} duplicate player-match combinations\n`);

    for (const dup of duplicates.rows) {
      // Get all entries for this player-match combo
      const entries = await client.query(
        `SELECT pgs.id, pgs.team_id, pgs.game_date, t.abbreviation
         FROM player_game_stats pgs
         JOIN teams t ON pgs.team_id = t.id
         WHERE pgs.player_id = $1 AND pgs.match_id = $2
         ORDER BY pgs.id`,
        [dup.player_id, dup.match_id]
      );

      // Get player name
      const playerResult = await client.query(
        'SELECT first_name, last_name FROM players WHERE id = $1',
        [dup.player_id]
      );
      const playerName = `${playerResult.rows[0].first_name} ${playerResult.rows[0].last_name}`;

      console.log(`${playerName} (Match ${dup.match_id}): ${dup.cnt} entries`);
      console.log(`  ✓ Keeping ID ${entries.rows[0].id} (${entries.rows[0].abbreviation})`);

      // Delete all duplicate entries except the first one
      for (let i = 1; i < entries.rows.length; i++) {
        console.log(`  ✗ Deleting ID ${entries.rows[i].id} (${entries.rows[i].abbreviation})`);
        await client.query('DELETE FROM player_game_stats WHERE id = $1', [entries.rows[i].id]);
      }
      console.log();
    }

    // Delete old hist-* games
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Deleting old hist-* games...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const histStats = await client.query(`
      DELETE FROM player_game_stats
      WHERE match_id IN (SELECT id FROM matches WHERE nba_game_id LIKE 'hist-%')
    `);
    console.log(`✓ Deleted ${histStats.rowCount} hist game stats`);

    const histMatches = await client.query(`
      DELETE FROM matches WHERE nba_game_id LIKE 'hist-%'
    `);
    console.log(`✓ Deleted ${histMatches.rowCount} hist matches\n`);

    // Update player team assignments
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Updating player team assignments...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const updateResult = await client.query(`
      WITH latest_games AS (
        SELECT DISTINCT ON (player_id)
          player_id,
          team_id
        FROM player_game_stats
        ORDER BY player_id, game_date DESC, id DESC
      )
      UPDATE players p
      SET current_team_id = lg.team_id
      FROM latest_games lg
      WHERE p.id = lg.player_id
      RETURNING p.id
    `);

    console.log(`✓ Updated ${updateResult.rowCount} player team assignments\n`);

    await client.query('COMMIT');

    console.log('===========================================');
    console.log('✅ Duplicates Fixed!');
    console.log('===========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixDuplicates()
    .then(() => {
      console.log('✅ Fix completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixDuplicates };
