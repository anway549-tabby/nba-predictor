import pool from '../../config/database';

(async () => {
  console.log('Fixing LeBron James team assignment...\n');

  // Get Lakers team ID
  const lakersResult = await pool.query(
    'SELECT id FROM teams WHERE abbreviation = $1',
    ['LAL']
  );

  if (lakersResult.rows.length === 0) {
    console.log('❌ Lakers team not found!');
    await pool.end();
    process.exit(1);
  }

  const lakersTeamId = lakersResult.rows[0].id;
  console.log(`✓ Lakers team ID: ${lakersTeamId}`);

  // Update both LeBron James records
  const updateResult = await pool.query(
    'UPDATE players SET current_team_id = $1 WHERE last_name = $2 AND first_name = $3',
    [lakersTeamId, 'James', 'LeBron']
  );

  console.log(`✓ Updated ${updateResult.rowCount} LeBron James record(s) to Lakers\n`);

  await pool.end();
  process.exit(0);
})();
