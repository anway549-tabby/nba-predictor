/**
 * Additive migrations
 *
 * schema.sql creates the base tables, but it is a FILE — and `tsc` does not
 * copy .sql into dist/, so on Railway `/api/admin/migrate` could never read it
 * (`ENOENT: /app/dist/db/schema.sql`). Anything that must reliably run against
 * production therefore lives here as inline SQL instead.
 *
 * Every statement must be idempotent (IF NOT EXISTS / IF EXISTS), because this
 * runs on every deploy and may be invoked by hand at any time.
 */

import type { Pool } from 'pg';

export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: 'matches.season_type',
    sql: `ALTER TABLE matches ADD COLUMN IF NOT EXISTS season_type INTEGER`
  },
  {
    name: 'matches.season_slug',
    sql: `ALTER TABLE matches ADD COLUMN IF NOT EXISTS season_slug VARCHAR(20)`
  },
  {
    name: 'idx_matches_season_type',
    sql: `CREATE INDEX IF NOT EXISTS idx_matches_season_type ON matches(season_type)`
  }
];

export interface MigrationResult {
  applied: string[];
  failed: Array<{ name: string; error: string }>;
}

/**
 * Run every additive migration in order. Each runs independently so one
 * failure does not block the rest; the caller reports what landed.
 */
export async function runMigrations(pool: Pool): Promise<MigrationResult> {
  const result: MigrationResult = { applied: [], failed: [] };

  for (const migration of MIGRATIONS) {
    try {
      await pool.query(migration.sql);
      result.applied.push(migration.name);
      console.log(`  migration ok: ${migration.name}`);
    } catch (error) {
      const message = (error as Error).message;
      result.failed.push({ name: migration.name, error: message });
      console.error(`  migration FAILED: ${migration.name} — ${message}`);
    }
  }

  return result;
}
