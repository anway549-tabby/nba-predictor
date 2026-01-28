# NBA Predictor - Backend

Backend API for the NBA Player Props Prediction Platform.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update with your database credentials:

```bash
copy .env.example .env
```

Then edit `.env` file with your PostgreSQL password.

### 3. Create Database

- Open pgAdmin 4
- Create database named `nba_predictor`
- Run the schema from `src/db/schema.sql`

### 4. Run Development Server

```bash
npm run dev
```

Server will start on http://localhost:3001

### 5. Test Health Check

Open browser: http://localhost:3001/health

Should see: `{"status":"healthy","database":"connected"}`

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database and Redis configuration
│   ├── db/              # Database schema and migrations
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   │   ├── ingestion/   # NBA data fetching
│   │   ├── prediction/  # Prediction engine
│   │   └── accuracy/    # Accuracy tracking
│   ├── types/           # TypeScript interfaces
│   ├── utils/           # Utility functions
│   └── server.ts        # Express server entry point
├── package.json
├── tsconfig.json
└── .env
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/matches?date=YYYY-MM-DD` - Get matches for a date
- `GET /api/players/:playerId/stats` - Get player's last 15 games
- `GET /api/predictions/:matchId` - Get predictions for a match

## Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production server
