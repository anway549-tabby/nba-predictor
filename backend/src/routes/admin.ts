/**
 * Admin Routes
 * Internal administrative endpoints
 */

import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../config/database';

const router = Router();

/**
 * POST /api/admin/migrate
 * Run database migration (creates all tables)
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Starting database migration...');

    // Read the schema file
    const schemaPath = join(__dirname, '../db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute the schema
    await pool.query(schema);

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = result.rows.map(row => row.table_name);

    console.log('✅ Migration completed successfully!');
    console.log('Created tables:', tables);

    res.json({
      success: true,
      message: 'Database migration completed successfully',
      tables
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: (error as Error).message
    });
  }
});

export default router;
