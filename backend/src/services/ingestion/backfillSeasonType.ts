/**
 * Backfill `matches.season_type` from ESPN
 *
 * Existing match rows predate the season_type column, so every one of them is
 * NULL — and NULL is treated as "not predictable", which would blank the whole
 * app until this runs. It is a one-shot repair; re-running it is harmless.
 *
 * HOW IT MATCHES
 * By ESPN event id (`matches.nba_game_id`), not by date. Our game_date is
 * derived from a UTC timestamp while ESPN's scoreboard is keyed by Eastern
 * date, so the two disagree by a day for late-night games — the same
 * off-by-one that already required a "fix schedule times" endpoint. Event ids
 * are unambiguous.
 *
 * It walks every calendar date spanned by our matches (padded a day each side
 * to absorb that ET/UTC skew), builds an eventId -> season map, then updates
 * each match from it.
 *
 * Usage:
 *   npx ts-node src/services/ingestion/backfillSeasonType.ts
 */

import axios from 'axios';
import pool from '../../config/database';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

const espnClient = axios.create({
  baseURL: ESPN_BASE_URL,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  timeout: 30000
});

export interface BackfillSeasonTypeResult {
  datesScanned: number;
  espnEventsSeen: number;
  matchesTotal: number;
  matchesUpdated: number;
  matchesUnmatched: number;
  byType: Record<string, number>;
  errors: string[];
}

function toEspnDate(d: Date): string {
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

export async function backfillSeasonType(): Promise<BackfillSeasonTypeResult> {
  const result: BackfillSeasonTypeResult = {
    datesScanned: 0,
    espnEventsSeen: 0,
    matchesTotal: 0,
    matchesUpdated: 0,
    matchesUnmatched: 0,
    byType: {},
    errors: []
  };

  console.log('\n===========================================');
  console.log('Backfill matches.season_type from ESPN');
  console.log('===========================================\n');

  // 1. Work out the date span to scan.
  const span = await pool.query(
    `SELECT MIN(game_time) as min_time, MAX(game_time) as max_time, COUNT(*) as total
     FROM matches`
  );

  result.matchesTotal = parseInt(span.rows[0].total, 10);

  if (result.matchesTotal === 0) {
    console.log('No matches to backfill.\n');
    return result;
  }

  // Pad one day each side: our timestamps are UTC, ESPN's scoreboard is keyed
  // by Eastern date, so a game can sit on the neighbouring ESPN date.
  const start = new Date(span.rows[0].min_time);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(span.rows[0].max_time);
  end.setUTCDate(end.getUTCDate() + 1);

  console.log(`Matches in database: ${result.matchesTotal}`);
  console.log(`Scanning ESPN from ${toEspnDate(start)} to ${toEspnDate(end)}\n`);

  // 2. Build eventId -> season map across the whole span.
  const seasonByEventId = new Map<string, { type: number | null; slug: string | null }>();

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateStr = toEspnDate(cursor);

    try {
      const { data } = await espnClient.get(`/scoreboard?dates=${dateStr}`);
      const events = data?.events ?? [];
      result.datesScanned++;

      for (const event of events) {
        if (!event?.id) continue;
        seasonByEventId.set(String(event.id), {
          type: event.season?.type ?? null,
          slug: event.season?.slug ?? null
        });
        result.espnEventsSeen++;
      }

      if (events.length > 0) {
        console.log(`  ${dateStr}: ${events.length} events`);
      }

      await new Promise(r => setTimeout(r, 120));
    } catch (error) {
      const msg = `Failed to fetch ESPN scoreboard for ${dateStr}: ${error}`;
      console.error(`  ERROR ${msg}`);
      result.errors.push(msg);
    }
  }

  console.log(`\nESPN events collected: ${seasonByEventId.size}\n`);

  if (seasonByEventId.size === 0) {
    throw new Error('ESPN returned no events for the entire span — aborting without writing');
  }

  // 3. Update every match from the map.
  const matches = await pool.query('SELECT id, nba_game_id FROM matches');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const match of matches.rows) {
      const season = seasonByEventId.get(String(match.nba_game_id));

      if (!season || season.type === null) {
        result.matchesUnmatched++;
        continue;
      }

      await client.query(
        'UPDATE matches SET season_type = $1, season_slug = $2 WHERE id = $3',
        [season.type, season.slug, match.id]
      );

      result.matchesUpdated++;
      const key = season.slug ?? `type-${season.type}`;
      result.byType[key] = (result.byType[key] ?? 0) + 1;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log('----------------------------------------');
  console.log('Backfill complete');
  console.log('----------------------------------------');
  console.log(`   Dates scanned:     ${result.datesScanned}`);
  console.log(`   Matches updated:   ${result.matchesUpdated} / ${result.matchesTotal}`);
  console.log(`   Unmatched (left NULL): ${result.matchesUnmatched}`);
  console.log(`   By season type:`);
  Object.entries(result.byType).forEach(([k, v]) => console.log(`     ${k.padEnd(16)} ${v}`));
  console.log('');

  if (result.matchesUnmatched > 0) {
    console.log(
      `   NOTE: ${result.matchesUnmatched} match(es) had no ESPN event on any scanned\n` +
      `   date. These keep season_type NULL and are therefore never predicted.\n`
    );
  }

  return result;
}

if (require.main === module) {
  backfillSeasonType()
    .then(() => {
      console.log('Backfill script completed\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Backfill failed:', error);
      process.exit(1);
    });
}
