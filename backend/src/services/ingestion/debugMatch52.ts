/**
 * Debug Match 52 - Check why predictions aren't generating
 */

import pool from '../../config/database';

async function debugMatch52() {
  console.log('\n🔍 Debugging Match 52 Predictions\n');
  console.log('==========================================\n');

  try {
    // Get match info
    const match = await pool.query(`
      SELECT m.id, m.home_team_id, m.away_team_id,
             ht.abbreviation as home, at.abbreviation as away
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.id = 52
    `);

    if (match.rows.length === 0) {
      console.log('❌ Match 52 not found\n');
      await pool.end();
      return;
    }

    const m = match.rows[0];
    console.log(`Match: ${m.away} @ ${m.home}`);
    console.log(`Home Team ID: ${m.home_team_id}`);
    console.log(`Away Team ID: ${m.away_team_id}\n`);

    // Check players for home team
    const homePlayers = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE current_team_id = $1',
      [m.home_team_id]
    );
    console.log(`Players on ${m.home} (ID ${m.home_team_id}): ${homePlayers.rows[0].count}`);

    // Check players for away team
    const awayPlayers = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE current_team_id = $1',
      [m.away_team_id]
    );
    console.log(`Players on ${m.away} (ID ${m.away_team_id}): ${awayPlayers.rows[0].count}\n`);

    // Check players with 15+ games from both teams
    const eligiblePlayers = await pool.query(`
      SELECT p.id, p.first_name, p.last_name, t.abbreviation,
             COUNT(pgs.id) as games
      FROM players p
      JOIN teams t ON p.current_team_id = t.id
      LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
      WHERE t.id IN ($1, $2)
      GROUP BY p.id, p.first_name, p.last_name, t.abbreviation
      HAVING COUNT(pgs.id) >= 15
      ORDER BY games DESC
    `, [m.home_team_id, m.away_team_id]);

    console.log(`Players with 15+ games from both teams: ${eligiblePlayers.rows.length}\n`);

    if (eligiblePlayers.rows.length > 0) {
      console.log('Sample eligible players:');
      eligiblePlayers.rows.slice(0, 10).forEach(p => {
        console.log(`  ${p.first_name} ${p.last_name} (${p.abbreviation}): ${p.games} games`);
      });
    }

    console.log('\n==========================================\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugMatch52();
