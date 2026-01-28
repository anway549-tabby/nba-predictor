import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
// Use DATABASE_URL if available (Railway, Heroku, etc.), otherwise use individual vars
export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        // Connection pool settings to prevent timeouts
        max: 10, // Maximum pool size
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 10000, // Timeout after 10 seconds
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'nba_predictor',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        // Connection pool settings
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      }
);

// Connection event handlers
pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
  process.exit(-1);
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

export default pool;
