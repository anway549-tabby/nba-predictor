import pool from '../../config/database';

(async () => {
  const result = await pool.query(`
    SELECT pgs.id, m.nba_game_id, t.abbreviation as team, pgs.game_date,
           ht.abbreviation as home, at.abbreviation as away
    FROM player_game_stats pgs
    JOIN players p ON pgs.player_id = p.id
    JOIN teams t ON pgs.team_id = t.id
    JOIN matches m ON pgs.match_id = m.id
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE p.last_name = 'James' AND p.first_name = 'LeBron'
    ORDER BY pgs.game_date DESC
    LIMIT 5
  `);

  console.log('LeBron recent games:');
  result.rows.forEach(r => {
    const date = new Date(r.game_date).toISOString().split('T')[0];
    console.log(`  ${date} - Team: ${r.team}, Game: ${r.away} @ ${r.home}, ESPN ID: ${r.nba_game_id}`);
  });

  await pool.end();
  process.exit(0);
})();
