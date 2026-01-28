import pool from '../../config/database';

(async () => {
  try {
    const preds = await pool.query('SELECT COUNT(*) as count FROM predictions');
    console.log('Total predictions:', preds.rows[0].count);

    const scheduled = await pool.query("SELECT COUNT(*) as count FROM matches WHERE status = 'scheduled'");
    console.log('Scheduled matches:', scheduled.rows[0].count);

    const sample = await pool.query(`
      SELECT m.nba_game_id, COUNT(p.id) as pred_count
      FROM matches m
      LEFT JOIN predictions p ON m.id = p.match_id
      WHERE m.status = 'scheduled'
      GROUP BY m.id, m.nba_game_id
      ORDER BY m.game_time
      LIMIT 5
    `);

    console.log('\nSample matches with predictions:');
    sample.rows.forEach(r => console.log(`  Game ${r.nba_game_id}: ${r.pred_count} predictions`));

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
