/**
 * Quick Team Fix
 * Update player teams based on most recent NON-hist game
 */

import pool from '../../config/database';

async function quickTeamFix() {
  console.log('Updating player teams (excluding hist games)...\n');

  try {
    const updateResult = await pool.query(`
      UPDATE players p
      SET current_team_id = (
        SELECT pgs.team_id
        FROM player_game_stats pgs
        JOIN matches m ON pgs.match_id = m.id
        WHERE pgs.player_id = p.id
          AND m.nba_game_id NOT LIKE 'hist-%'
        ORDER BY pgs.game_date DESC, pgs.id DESC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1
        FROM player_game_stats pgs
        JOIN matches m ON pgs.match_id = m.id
        WHERE pgs.player_id = p.id
          AND m.nba_game_id NOT LIKE 'hist-%'
      )
    `);

    console.log(`✓ Updated ${updateResult.rowCount} player teams\n`);

    // Verify LeBron
    const lebron = await pool.query(`
      SELECT p.first_name, p.last_name, t.abbreviation as team
      FROM players p
      JOIN teams t ON p.current_team_id = t.id
      WHERE p.first_name = 'LeBron' AND p.last_name = 'James'
    `);

    if (lebron.rows.length > 0) {
      console.log(`LeBron James: ${lebron.rows[0].team}`);
    }

    console.log('\n✅ Done!');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

if (require.main === module) {
  quickTeamFix()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { quickTeamFix };
