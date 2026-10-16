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

// ---------------------------------------------------------------------------
// Season types (ESPN `season.type`) — PRD scope is "Regular season + playoffs"
// ---------------------------------------------------------------------------
// Verified against ESPN's scoreboard on a spread of real dates:
//   1 = preseason     (e.g. 2025-10-10, 2026-10-16)
//   2 = regular-season (e.g. 2026-01-15)
//   3 = post-season    (e.g. 2026-04-25, 2026-06-10)
//
// CAUTION: season type does NOT identify the All-Star Game. ESPN labels the
// 2026 All-Star events (WORLD / STARS / STRIPES) as type 2 "regular-season".
// All-Star is excluded by the NBA-abbreviation guard (`isNBATeam`) instead, so
// both filters are required — see PREDICTABLE_SEASON_TYPES usage.
export const SEASON_TYPE = {
  PRESEASON: 1,
  REGULAR: 2,
  POSTSEASON: 3
} as const;

// The only season types that may be predicted, or counted toward a player's
// last-15 window. Preseason ("practice") games are excluded from both.
export const PREDICTABLE_SEASON_TYPES: readonly number[] = [
  SEASON_TYPE.REGULAR,
  SEASON_TYPE.POSTSEASON
];

// SQL fragment for the above, for use in queries against `matches`.
export const PREDICTABLE_SEASON_TYPES_SQL = '(2, 3)';
