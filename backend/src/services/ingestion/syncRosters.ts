/**
 * Roster Sync (ESPN)
 *
 * Rebuilds `players.current_team_id` from ESPN's 30 live team rosters.
 *
 * WHY THIS EXISTS
 * Predictions for a match are generated for every player whose
 * `current_team_id` points at either team (see predictionService). So a stale
 * team assignment does not just show the wrong badge — it injects players into
 * matches they are not part of. The DB had accumulated more players per team
 * than a real active roster holds, because team assignment was only ever a
 * side effect of ingesting box scores.
 *
 * WHAT IT DOES
 *  - For every athlete on a current ESPN roster: upsert the player and set
 *    current_team_id to that team.
 *  - For every player NOT on any current roster (retired, waived, overseas):
 *    clear current_team_id. The prediction query inner-joins teams, so they
 *    drop out of match rosters automatically. Their historical stats are
 *    untouched — player_game_stats records the team per game — so they still
 *    count toward their own history and they reappear if they sign again.
 *
 * Players are keyed by `players.nba_player_id`, which holds the ESPN athlete
 * id (set that way by espnDataStorage), so the match is exact, not by name.
 *
 * Usage:
 *   npx ts-node src/services/ingestion/syncRosters.ts
 */

import axios from 'axios';
import pool from '../../config/database';
import { isNBATeam } from './espnDataStorage';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

const espnClient = axios.create({
  baseURL: ESPN_BASE_URL,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  timeout: 30000
});

export interface RosterSyncResult {
  teamsProcessed: number;
  playersOnRosters: number;
  playersCreated: number;
  teamChanged: number;
  playersCleared: number;
  changes: Array<{ player: string; from: string | null; to: string | null }>;
  errors: string[];
}

interface ESPNTeamRef {
  id: string;
  abbreviation: string;
  displayName: string;
}

interface RosterAthlete {
  espnId: string;
  firstName: string;
  lastName: string;
  position: string;
}

/** All 30 NBA teams from ESPN, filtered to real franchises. */
async function fetchESPNTeams(): Promise<ESPNTeamRef[]> {
  const { data } = await espnClient.get('/teams');
  const entries = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];

  return entries
    .map((e: any) => e.team)
    .filter((t: any) => t?.abbreviation && isNBATeam(t.abbreviation))
    .map((t: any) => ({
      id: String(t.id),
      abbreviation: t.abbreviation,
      displayName: t.displayName
    }));
}

/** Athletes currently on one team's roster. */
async function fetchTeamRoster(teamId: string): Promise<RosterAthlete[]> {
  const { data } = await espnClient.get(`/teams/${teamId}/roster`);
  const athletes = data?.athletes ?? data?.team?.athletes ?? [];

  return athletes
    .filter((a: any) => a?.id && a?.displayName)
    .map((a: any) => {
      // ESPN usually gives firstName/lastName separately, but not always —
      // fall back to splitting displayName so a missing field never drops a
      // player from the roster.
      const parts = String(a.displayName).trim().split(/\s+/);
      return {
        espnId: String(a.id),
        firstName: a.firstName || parts[0] || 'Unknown',
        lastName: a.lastName || parts.slice(1).join(' ') || parts[0] || 'Unknown',
        position: a.position?.abbreviation || 'Unknown'
      };
    });
}

export async function syncRosters(): Promise<RosterSyncResult> {
  const result: RosterSyncResult = {
    teamsProcessed: 0,
    playersOnRosters: 0,
    playersCreated: 0,
    teamChanged: 0,
    playersCleared: 0,
    changes: [],
    errors: []
  };

  console.log('\n===========================================');
  console.log('Roster Sync (ESPN current rosters)');
  console.log('===========================================\n');

  const teams = await fetchESPNTeams();
  console.log(`Found ${teams.length} NBA teams from ESPN\n`);

  // Refuse to proceed on a partial team list: every player missing from it
  // would be wrongly cleared below.
  if (teams.length < 30) {
    throw new Error(
      `Expected 30 NBA teams from ESPN, got ${teams.length} — ` +
      `aborting rather than clearing valid rosters`
    );
  }

  // Collect every roster FIRST, so a mid-way ESPN failure cannot leave the DB
  // half-synced with players wrongly cleared.
  const rosters: Array<{ team: ESPNTeamRef; athletes: RosterAthlete[] }> = [];

  for (const team of teams) {
    try {
      const athletes = await fetchTeamRoster(team.id);
      rosters.push({ team, athletes });
      console.log(`  ${team.abbreviation.padEnd(5)} ${String(athletes.length).padStart(2)} players`);
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      const msg = `Failed to fetch roster for ${team.abbreviation}: ${error}`;
      console.error(`  ERROR ${msg}`);
      result.errors.push(msg);
    }
  }

  if (result.errors.length > 0) {
    throw new Error(
      `${result.errors.length} roster fetch(es) failed — aborting. ` +
      `A partial sync would clear players whose roster could not be read.`
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const seenEspnIds: number[] = [];

    for (const { team, athletes } of rosters) {
      // Resolve our team row by abbreviation (stable), not by ESPN id.
      const teamRow = await client.query(
        'SELECT id FROM teams WHERE abbreviation = $1 LIMIT 1',
        [team.abbreviation]
      );

      if (teamRow.rows.length === 0) {
        const msg = `Team ${team.abbreviation} not in database — skipped`;
        console.warn(`  WARN ${msg}`);
        result.errors.push(msg);
        continue;
      }

      const teamDbId = teamRow.rows[0].id;
      result.teamsProcessed++;

      for (const athlete of athletes) {
        const espnId = parseInt(athlete.espnId, 10);
        if (!Number.isFinite(espnId)) continue;

        seenEspnIds.push(espnId);
        result.playersOnRosters++;

        const existing = await client.query(
          `SELECT p.id, p.first_name, p.last_name, t.abbreviation as team
           FROM players p
           LEFT JOIN teams t ON p.current_team_id = t.id
           WHERE p.nba_player_id = $1`,
          [espnId]
        );

        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO players (nba_player_id, first_name, last_name, position, current_team_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [espnId, athlete.firstName, athlete.lastName, athlete.position, teamDbId]
          );
          result.playersCreated++;
          result.changes.push({
            player: `${athlete.firstName} ${athlete.lastName}`,
            from: null,
            to: team.abbreviation
          });
          continue;
        }

        const row = existing.rows[0];

        if (row.team !== team.abbreviation) {
          result.teamChanged++;
          result.changes.push({
            player: `${row.first_name} ${row.last_name}`,
            from: row.team,
            to: team.abbreviation
          });
        }

        // Refresh name and position too — ESPN is the source of truth, and
        // box-score ingestion sometimes stores a shortened name.
        await client.query(
          `UPDATE players
           SET current_team_id = $1,
               first_name = $2,
               last_name = $3,
               position = COALESCE(NULLIF($4, 'Unknown'), position)
           WHERE id = $5`,
          [teamDbId, athlete.firstName, athlete.lastName, athlete.position, row.id]
        );
      }
    }

    // Anyone not on a current roster loses their team assignment, so they stop
    // being predicted into that team's matches.
    const cleared = await client.query(
      `UPDATE players
       SET current_team_id = NULL
       WHERE current_team_id IS NOT NULL
         AND NOT (nba_player_id = ANY($1::int[]))
       RETURNING first_name, last_name`,
      [seenEspnIds]
    );

    result.playersCleared = cleared.rowCount ?? 0;

    await client.query('COMMIT');

    console.log('\n----------------------------------------');
    console.log('Roster sync complete');
    console.log('----------------------------------------');
    console.log(`   Teams processed:      ${result.teamsProcessed}`);
    console.log(`   Players on rosters:   ${result.playersOnRosters}`);
    console.log(`   New players created:  ${result.playersCreated}`);
    console.log(`   Team reassigned:      ${result.teamChanged}`);
    console.log(`   Cleared (off roster): ${result.playersCleared}`);

    if (result.changes.length > 0) {
      console.log(`\n   Changes (${result.changes.length}):`);
      result.changes.slice(0, 40).forEach(c => {
        const from = c.from === null ? '(new)' : c.from;
        console.log(`     ${c.player.padEnd(26)} ${String(from).padEnd(7)} -> ${c.to}`);
      });
      if (result.changes.length > 40) {
        console.log(`     ... and ${result.changes.length - 40} more`);
      }
    }
    console.log('');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  syncRosters()
    .then(() => {
      console.log('Roster sync script completed\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Roster sync failed:', error);
      process.exit(1);
    });
}
