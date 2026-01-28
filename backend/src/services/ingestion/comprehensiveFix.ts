/**
 * Comprehensive Fix Script
 *
 * Fixes:
 * 1. Duplicate player entries (LeBron James)
 * 2. Player team assignments based on most recent game
 * 3. Fetches upcoming schedule for next 7 days
 */

import pool from '../../config/database';
import { fetchESPNScoreboard, convertESPNGame } from './espnApiClient';
import { saveESPNGame, logDataRefresh } from './espnDataStorage';

async function comprehensiveFix() {
  console.log('\n===========================================');
  console.log('🔧 Running Comprehensive Fix');
  console.log('===========================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ============================================
    // FIX 1: Consolidate duplicate LeBron James
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FIX 1: Consolidating Duplicate Players');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const duplicatePlayers = await client.query(`
      SELECT first_name, last_name, array_agg(id ORDER BY id) as ids, array_agg(nba_player_id) as nba_ids
      FROM players
      GROUP BY first_name, last_name
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${duplicatePlayers.rows.length} duplicate player names`);

    for (const dup of duplicatePlayers.rows) {
      const keepId = dup.ids[0];
      const removeIds = dup.ids.slice(1);

      console.log(`${dup.first_name} ${dup.last_name}: Keeping ID ${keepId}, removing ${removeIds.join(', ')}`);

      for (const removeId of removeIds) {
        // Move stats to the kept player
        await client.query(
          'UPDATE player_game_stats SET player_id = $1 WHERE player_id = $2',
          [keepId, removeId]
        );

        // Move predictions
        await client.query(
          'UPDATE predictions SET player_id = $1 WHERE player_id = $2',
          [keepId, removeId]
        );

        // Delete duplicate
        await client.query('DELETE FROM players WHERE id = $1', [removeId]);
      }
    }

    console.log();

    // ============================================
    // FIX 2: Update player teams based on most recent game
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FIX 2: Updating Player Team Assignments');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all players with their most recent team from game stats
    const playerTeams = await client.query(`
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
      WHERE p.id = lg.player_id AND p.current_team_id != lg.team_id
      RETURNING p.id
    `);

    console.log(`✓ Updated ${playerTeams.rowCount} player team assignments\n`);

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during fix:', error);
    throw error;
  } finally {
    client.release();
  }

  // ============================================
  // FIX 3: Fetch upcoming schedule (next 7 days)
  // ============================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FIX 3: Fetching Upcoming Schedule');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let totalGames = 0;
  const errors: string[] = [];
  const today = new Date();

  for (let i = 0; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    try {
      console.log(`Fetching ${dateStr}...`);

      const espnGames = await fetchESPNScoreboard(dateStr);
      const games = espnGames.map(g => convertESPNGame(g));

      if (games.length === 0) {
        console.log(`  ℹ️  No games scheduled\n`);
        continue;
      }

      console.log(`  ✓ Found ${games.length} game(s)`);

      for (const game of games) {
        try {
          await saveESPNGame(game);
          console.log(`    ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} (${game.status})`);
          totalGames++;
        } catch (err: any) {
          if (err.code !== '23505') { // Ignore duplicate key errors
            console.error(`    ⚠️  Error saving ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}:`, err.message);
            errors.push(`${dateStr}: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} - ${err.message}`);
          }
        }
      }

      console.log();
      await new Promise(r => setTimeout(r, 300));

    } catch (error: any) {
      console.error(`  ❌ Error fetching ${dateStr}:`, error.message);
      errors.push(`${dateStr}: ${error.message}`);
    }
  }

  console.log('===========================================');
  console.log('✅ Comprehensive Fix Completed!');
  console.log('===========================================');
  console.log(`\n📊 Summary:`);
  console.log(`   - Duplicate players consolidated`);
  console.log(`   - Player teams updated`);
  console.log(`   - Upcoming games saved: ${totalGames}`);
  console.log(`   - Errors: ${errors.length}\n`);

  if (errors.length > 0 && errors.length <= 10) {
    console.log('⚠️  Errors:');
    errors.forEach(err => console.log(`   - ${err}`));
    console.log();
  }

  await pool.end();
}

// Run if called directly
if (require.main === module) {
  comprehensiveFix()
    .then(() => {
      console.log('✅ Comprehensive fix completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Comprehensive fix failed:', error);
      process.exit(1);
    });
}

export { comprehensiveFix };
