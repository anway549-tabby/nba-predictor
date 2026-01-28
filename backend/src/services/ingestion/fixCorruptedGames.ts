/**
 * Fix Corrupted Games
 *
 * Deletes and re-processes games with corrupted team assignments
 */

import pool from '../../config/database';
import { fetchESPNGameSummary, parseESPNPlayerStats } from './espnApiClient';
import { saveESPNPlayerStat } from './espnDataStorage';

async function fixCorruptedGames() {
  console.log('\n===========================================');
  console.log('🔧 Fixing Corrupted Game Stats');
  console.log('===========================================\n');

  const client = await pool.connect();

  try {
    // Find games where home team = away team (corrupted)
    const corruptedMatches = await client.query(`
      SELECT m.id, m.nba_game_id,
             ht.abbreviation as home_abbr,
             at.abbreviation as away_abbr
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE ht.id = at.id
    `);

    console.log(`Found ${corruptedMatches.rows.length} corrupted matches\n`);

    // Check for stats where team = opponent (also corrupted)
    const corruptedStats = await client.query(`
      SELECT DISTINCT match_id, m.nba_game_id
      FROM player_game_stats pgs
      JOIN matches m ON pgs.match_id = m.id
      WHERE pgs.team_id = pgs.opponent_team_id
    `);

    console.log(`Found ${corruptedStats.rows.length} matches with corrupted stats\n`);

    if (corruptedMatches.rows.length === 0 && corruptedStats.rows.length === 0) {
      console.log('✅ No corruption found!');
      await client.release();
      await pool.end();
      return;
    }

    // Process corrupted stats (team = opponent)
    for (const stat of corruptedStats.rows) {
      console.log(`Fixing match ${stat.nba_game_id}...`);

      // Delete all stats for this match
      const deleteResult = await client.query(
        'DELETE FROM player_game_stats WHERE match_id = $1',
        [stat.match_id]
      );
      console.log(`  ✓ Deleted ${deleteResult.rowCount} corrupted stats`);

      // Fetch fresh data from ESPN
      const gameSummary = await fetchESPNGameSummary(stat.nba_game_id);
      if (gameSummary?.boxscore) {
        const playerStats = parseESPNPlayerStats(gameSummary.boxscore, stat.nba_game_id);
        console.log(`  📊 Found ${playerStats.length} player stats from ESPN`);

        for (const playerStat of playerStats) {
          await saveESPNPlayerStat(playerStat, stat.match_id);
        }
        console.log(`  ✓ Saved fresh stats\n`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Process corrupted matches (home = away) - update with correct teams from ESPN
    for (const match of corruptedMatches.rows) {
      console.log(`Fixing corrupted match ${match.nba_game_id}...`);

      try {
        // Fetch fresh match data from ESPN
        const gameSummary = await fetchESPNGameSummary(match.nba_game_id);
        if (gameSummary?.header?.competitions?.[0]) {
          const comp = gameSummary.header.competitions[0];
          const homeTeam = comp.competitors.find((c: any) => c.homeAway === 'home');
          const awayTeam = comp.competitors.find((c: any) => c.homeAway === 'away');

          if (homeTeam && awayTeam) {
            // Get correct team IDs from database
            const homeTeamResult = await client.query(
              'SELECT id FROM teams WHERE abbreviation = $1 LIMIT 1',
              [homeTeam.team.abbreviation]
            );
            const awayTeamResult = await client.query(
              'SELECT id FROM teams WHERE abbreviation = $1 LIMIT 1',
              [awayTeam.team.abbreviation]
            );

            if (homeTeamResult.rows.length > 0 && awayTeamResult.rows.length > 0) {
              await client.query(
                'UPDATE matches SET home_team_id = $1, away_team_id = $2 WHERE id = $3',
                [homeTeamResult.rows[0].id, awayTeamResult.rows[0].id, match.id]
              );
              console.log(`  ✓ Updated match: ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}\n`);
            }
          }
        }
      } catch (error) {
        console.error(`  ❌ Error fixing match ${match.nba_game_id}:`, error);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Now update all player current_team_id based on latest game
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Updating all player team assignments...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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

    console.log('===========================================');
    console.log('✅ Corruption Fixed!');
    console.log('===========================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixCorruptedGames()
    .then(() => {
      console.log('✅ Fix completed! Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixCorruptedGames };
