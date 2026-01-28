import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import pool, { testConnection } from './config/database';

// Import routes
import matchesRouter from './routes/matches';
import playersRouter from './routes/players';
import predictionsRouter from './routes/predictions';
import adminRouter from './routes/admin';

// Import daily refresh job (ESPN-based)
import { runDailyRefreshESPN } from './services/ingestion/dailyRefreshESPN';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Middleware
app.use(cors()); // Enable CORS for frontend
app.use(express.json()); // Parse JSON request bodies

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');

    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'NBA Player Props Prediction Platform - API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      matches: '/api/matches',
      players: '/api/players/:playerId/stats',
      predictions: '/api/predictions/:matchId'
    }
  });
});

// API Routes
app.use('/api/matches', matchesRouter);
app.use('/api/players', playersRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/admin', adminRouter);

/**
 * Check if today's refresh has run, if not run it immediately
 */
async function checkAndRunStartupRefresh() {
  try {
    // Get today's date in IST
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = istDate.toISOString().split('T')[0];

    // Check if refresh has already run today
    const lastRefresh = await pool.query(
      `SELECT refresh_date, status, refresh_timestamp FROM data_refresh_log
       WHERE refresh_date = $1 AND status = 'success'
       ORDER BY refresh_timestamp DESC LIMIT 1`,
      [todayIST]
    );

    if (lastRefresh.rows.length === 0) {
      console.log('\n🔄 No refresh found for today. Running startup refresh...');
      await runDailyRefreshESPN();
      console.log('✅ Startup refresh completed\n');
    } else {
      const timestamp = new Date(lastRefresh.rows[0].refresh_timestamp).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true
      });
      console.log(`✓ Today's refresh already completed at ${timestamp} IST\n`);
    }
  } catch (error) {
    console.error('⚠️  Startup refresh check failed:', error);
    console.log('   Server will continue and wait for scheduled refresh at 12:00 Noon IST\n');
  }
}

// Start server
async function startServer() {
  try {
    // Test database connection first
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Please check your .env configuration.');
      process.exit(1);
    }

    // Start Express server
    // Bind to 0.0.0.0 for Railway and other cloud platforms
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log('\n🚀 NBA Predictor Backend Server Started');
      console.log('=====================================');
      console.log(`✓ Server running on http://${HOST}:${PORT}`);
      console.log(`✓ Health check: http://${HOST}:${PORT}/health`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('=====================================\n');
    });

    // Skip startup refresh in production to avoid crashes during deployment
    if (process.env.NODE_ENV !== 'production') {
      await checkAndRunStartupRefresh();
    } else {
      console.log('⏭️  Skipping startup refresh in production (use scheduled cron job instead)\n');
    }

    // Setup daily data refresh cron job (ESPN)
    // Runs every day at 12:00 Noon IST (6:30 AM UTC)
    cron.schedule('30 6 * * *', async () => {
      console.log('\n🕛 Running scheduled daily refresh (12:00 Noon IST - ESPN)...');
      try {
        await runDailyRefreshESPN();
        console.log('✅ Scheduled refresh completed successfully\n');
      } catch (error) {
        console.error('❌ Scheduled refresh failed:', error);
      }
    }, {
      timezone: "UTC"
    });

    console.log('⏰ Daily refresh job scheduled: Every day at 12:00 Noon IST (6:30 AM UTC)');
    console.log('📡 Data source: ESPN Public API (Free)\n');

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});
