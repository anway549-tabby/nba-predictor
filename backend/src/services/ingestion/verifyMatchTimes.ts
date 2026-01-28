import pool from '../../config/database';

async function verifyMatchTimes() {
  const result = await pool.query(`
    SELECT nba_game_id, game_time, game_date
    FROM matches
    WHERE game_date >= '2026-01-27' AND status = 'scheduled'
    ORDER BY game_time
    LIMIT 10
  `);

  console.log('Upcoming matches (first 10):\n');
  result.rows.forEach(r => {
    const utc = r.game_time.toISOString();
    const ist = new Date(r.game_time).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    console.log(`${r.nba_game_id}: ${ist} IST (UTC: ${utc})`);
  });

  await pool.end();
}

verifyMatchTimes();
