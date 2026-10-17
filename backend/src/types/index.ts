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

// Size of the prediction window (as per PRD - DO NOT MODIFY)
export const WINDOW_SIZE = 15;

// Minimum number of REAL games (ones the player actually appeared in) required
// before a prop is produced. Games 9-15 of the window are imputed from the
// player's own average, per the PRD's Minutes = 0 rule.
//
// WHY THERE IS A FLOOR AT ALL
// Imputed values all equal the player's mean, so they clear or fail a
// threshold as a single block. With only 1 real game, the other 14 values are
// copies of it — "14 of 15" then passes on a one-game sample and invents a
// confident prop. The floor is what stops that.
//
// WHY 8 (decided 2026-10-17)
// A rookie qualifies about two and a half weeks into the season rather than
// being excluded until his 15th appearance. At 8 real games a prop still needs
// the mean to clear the threshold AND 7 of the 8 real games to clear it too.
// Lowering this further weakens every prop; raising it to 15 removes
// imputation entirely and excludes rookies and low-minute players.
export const MIN_REAL_GAMES = 8;

// ---------------------------------------------------------------------------
// Season types (ESPN `season.type`) — PRD scope is "Regular season + playoffs"
// ---------------------------------------------------------------------------
// Verified against ESPN's scoreboard on a spread of real dates, and against
// the full backfill of all 1,238 matches:
//   1 = preseason      (e.g. 2025-10-10, 2026-10-16)
//   2 = regular-season (e.g. 2026-01-15)
//   3 = post-season    (e.g. 2026-04-25, 2026-06-10)
//   5 = play-in-season (the Play-In Tournament)
//
// CAUTION: season type does NOT identify the All-Star Game. ESPN labels the
// 2026 All-Star events (WORLD / STARS / STRIPES) as type 2 "regular-season".
// All-Star is excluded by the NBA-abbreviation guard (`isNBATeam`) instead, so
// both filters are required — see PREDICTABLE_SEASON_TYPES usage.
export const SEASON_TYPE = {
  PRESEASON: 1,
  REGULAR: 2,
  POSTSEASON: 3,
  PLAY_IN: 5
} as const;

// The only season types that may be predicted, or counted toward a player's
// last-15 window.
//
// Each exclusion is deliberate:
//   PRESEASON — "practice" games, explicitly out of scope.
//   PLAY_IN   — the PRD scopes this to "Regular season + playoffs", and the
//               Play-In Tournament is officially neither; the NBA keeps its
//               stats separate from regular-season totals. Decided
//               2026-10-17: keep it out. Adding SEASON_TYPE.PLAY_IN to this
//               list is all it would take to reverse that, so do not add it
//               on the assumption it was an oversight.
//   null      — a match whose type has not been confirmed is never predicted.
export const PREDICTABLE_SEASON_TYPES: readonly number[] = [
  SEASON_TYPE.REGULAR,
  SEASON_TYPE.POSTSEASON
];

// SQL fragment for the above, for use in queries against `matches`.
export const PREDICTABLE_SEASON_TYPES_SQL = '(2, 3)';
