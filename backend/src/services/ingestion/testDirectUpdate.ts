import pool from '../../config/database';

async function testDirectUpdate() {
  const client = await pool.connect();

  try {
    // Check current value
    const before = await client.query(
      'SELECT id, nba_game_id, game_time FROM matches WHERE nba_game_id = $1',
      ['401810519']
    );
    console.log('BEFORE UPDATE:');
    console.log('  game_time:', before.rows[0].game_time);
    console.log('  as ISO:', before.rows[0].game_time.toISOString());

    // Update directly (no transaction) - try with Date object
    const newTime = new Date('2026-01-28T00:00:00.000Z');
    console.log('\nAttempting UPDATE with:');
    console.log('  newTime (Date object):', newTime);
    console.log('  newTime.toISOString():', newTime.toISOString());
    console.log('  nba_game_id:', '401810519');

    const updateResult = await client.query(
      'UPDATE matches SET game_time = $1 WHERE nba_game_id = $2 RETURNING id, nba_game_id, game_time',
      [newTime, '401810519']
    );
    console.log('\n✓ UPDATE executed');
    console.log('  Rows affected:', updateResult.rowCount);
    if (updateResult.rows.length > 0) {
      console.log('  RETURNING shows:', updateResult.rows[0].game_time.toISOString());
    }

    // Check immediately
    const after = await client.query(
      'SELECT id, nba_game_id, game_time FROM matches WHERE nba_game_id = $1',
      ['401810519']
    );
    console.log('\nAFTER UPDATE (same connection):');
    console.log('  game_time:', after.rows[0].game_time);
    console.log('  as ISO:', after.rows[0].game_time.toISOString());

    client.release();

    // Check from a fresh connection
    const fresh = await pool.query(
      'SELECT id, nba_game_id, game_time FROM matches WHERE nba_game_id = $1',
      ['401810519']
    );
    console.log('\nFROM FRESH CONNECTION:');
    console.log('  game_time:', fresh.rows[0].game_time);
    console.log('  as ISO:', fresh.rows[0].game_time.toISOString());

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testDirectUpdate();
}

export { testDirectUpdate };
