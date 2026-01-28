/**
 * TypeScript type definitions for NBA Predictor
 */

// Game stat from player's last 15 games
export interface GameStat {
  date: string;
  opponent: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  isImputed: boolean;
}

// Input for prediction engine
export interface PredictionInput {
  playerId: number;
  matchId: number;
  last15Games: GameStat[];
}

// Output from prediction engine
export interface PredictionOutput {
  playerId: number;
  matchId: number;
  pointsThreshold: number | null;
  reboundsThreshold: number | null;
  assistsThreshold: number | null;
  gamesAnalyzed: number;
}

// Prediction thresholds (as per PRD - DO NOT MODIFY)
export const THRESHOLDS = {
  points: [30, 25, 20, 15, 10],
  rebounds: [12, 10, 8, 6, 4],
  assists: [10, 8, 6, 4, 2]
} as const;

// Qualifying count: 14 out of 15 games (as per PRD - DO NOT MODIFY)
export const QUALIFYING_COUNT = 14;
