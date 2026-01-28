import pool from '../../config/database';
import { fetchESPNGameSummary, parseESPNPlayerStats } from './espnApiClient';
import { saveESPNPlayerStat } from './espnDataStorage';

async function cleanupSeedData() {
  console.log('Cleaning up old seed data and fixing recent games...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete player_game_stats for old seed games first
    const deleteStatsResult = await client.query(`
      DELETE FROM player_game_stats
      WHERE match_id IN (
        SELECT id FROM matches WHERE nba_game_id LIKE 'hist-%' OR nba_game_id LIKE 'sample-%'
      )
    `);
    console.log(`✓ Deleted ${deleteStatsResult.rowCount} stats from old seed games`);

    // Now delete old historical seed games (hist-*)
    const deleteResult = await client.query(`
      DELETE FROM matches WHERE nba_game_id LIKE 'hist-%' OR nba_game_id LIKE 'sample-%'
    `);
    console.log(`✓ Deleted ${deleteResult.rowCount} old seed matches\n`);

    // Check for game 401810503 (Jan 24 LAL @ CLE)
    const matchResult = await client.query(
      'SELECT id, nba_game_id FROM matches WHERE nba_game_id = $1',
      ['401810503']
    );

    if (matchResult.rows.length > 0) {
      const matchId = matchResult.rows[0].id;
      console.log('Fixing game 401810503 (LAL @ CLE)...');

      // Delete existing stats
      const deleteStats = await client.query(
        'DELETE FROM player_game_stats WHERE match_id = $1',
        [matchId]
      );
      console.log(`  ✓ Deleted ${deleteStats.rowCount} stats`);

      // Re-fetch from ESPN
      const gameSummary = await fetchESPNGameSummary('401810503');
      if (gameSummary?.boxscore) {
        const playerStats = parseESPNPlayerStats(gameSummary.boxscore, '401810503');
        console.log(`  📊 Found ${playerStats.length} player stats from ESPN`);

        for (const stat of playerStats) {
          await saveESPNPlayerStat(stat, matchId);
        }
        console.log(`  ✓ Saved fresh stats\n`);
      }
    }

    // Update all player team assignments based on most recent game
    const updateResult = await client.query(`
      WITH latest_games AS (
        SELECT DISTINCT ON (player_id)
          player_id,
          team_id
        FROM player_game_stats
        ORDER BY player_id, game_date DESC
      )
      UPDATE players p
      SET current_team_id = lg.team_id
      FROM latest_games lg
      WHERE p.id = lg.player_id
      RETURNING p.id
    `);
    console.log(`✓ Updated ${updateResult.rowCount} player team assignments\n`);

    await client.query('COMMIT');
    console.log('✅ Cleanup completed!');

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
  cleanupSeedData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { cleanupSeedData };
