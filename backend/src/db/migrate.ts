/**
 * Database Migration Script
 * Runs the schema.sql file to set up the database tables
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../config/database';

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...\n');

    // Read the schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute the schema
    await pool.query(schema);

    console.log('✅ Migration completed successfully!\n');
    console.log('Created tables:');
    console.log('  - teams');
    console.log('  - players');
    console.log('  - matches');
    console.log('  - player_game_stats');
    console.log('  - predictions');
    console.log('  - data_refresh_log\n');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('Verified tables in database:');
    result.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
