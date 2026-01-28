/**
 * NBA Predictor - Prediction Engine
 *
 * This file implements the EXACT deterministic prediction logic from the PRD.
 *
 * RULES (DO NOT MODIFY):
 * 1. Use last 15 team games (even if player didn't play)
 * 2. If Minutes = 0, impute stats using average from games where Minutes > 0
 * 3. Evaluate thresholds from HIGHEST to LOWEST
 * 4. If count >= 14 out of 15, select that threshold
 * 5. Output ONLY the highest qualifying threshold
 * 6. If none qualify, output null
 */

import { GameStat, PredictionInput, PredictionOutput, THRESHOLDS, QUALIFYING_COUNT } from '../../types';

/**
 * Step 1: Validate that we have exactly 15 games
 */
function validateGames(games: GameStat[]): void {
  if (games.length !== 15) {
    throw new Error(`Expected exactly 15 games, got ${games.length}`);
  }
}

/**
 * Step 2: Impute stats for games where minutes = 0
 * Uses average from games where minutes > 0
 *
 * As per PRD: "If Minutes = 0, imputed value = average of matches where Minutes > 0"
 */
function imputeStats(games: GameStat[]): GameStat[] {
  // Get games where player actually played
  const playedGames = games.filter(g => g.minutes > 0);

  // If player never played in any game, cannot make predictions
  if (playedGames.length === 0) {
    console.warn('Player has 0 minutes in all 15 games - cannot impute stats');
    return games;
  }

  // Calculate averages from played games
  const avgPoints = Math.round(
    playedGames.reduce((sum, g) => sum + g.points, 0) / playedGames.length
  );
  const avgRebounds = Math.round(
    playedGames.reduce((sum, g) => sum + g.rebounds, 0) / playedGames.length
  );
  const avgAssists = Math.round(
    playedGames.reduce((sum, g) => sum + g.assists, 0) / playedGames.length
  );

  // Impute stats for games where minutes = 0
  return games.map(game => {
    if (game.minutes === 0) {
      return {
        ...game,
        points: avgPoints,
        rebounds: avgRebounds,
        assists: avgAssists,
        isImputed: true
      };
    }
    return game;
  });
}

/**
 * Step 3: Evaluate threshold (highest to lowest)
 * Returns first threshold where count >= 14 out of 15
 *
 * As per PRD:
 * - "Evaluate thresholds from highest to lowest"
 * - "If count >= 14 out of 15 → select that threshold"
 * - "Output ONLY the highest qualifying threshold"
 * - Threshold interpretation: "15+ means >= 15"
 */
function evaluateThreshold(
  stats: number[],
  thresholds: readonly number[]
): number | null {
  // Iterate from highest to lowest threshold
  for (const threshold of thresholds) {
    // Count how many games meet or exceed this threshold
    const count = stats.filter(stat => stat >= threshold).length;

    // If 14 or more games meet this threshold, it qualifies
    if (count >= QUALIFYING_COUNT) {
      return threshold;
    }
  }

  // No qualifying threshold found
  return null;
}

/**
 * Main Prediction Function
 *
 * Implements the complete deterministic prediction logic:
 * 1. Validate 15 games
 * 2. Impute missing stats (Minutes = 0)
 * 3. Evaluate thresholds (highest to lowest)
 * 4. Return only highest qualifying threshold per stat
 */
export function generatePrediction(input: PredictionInput): PredictionOutput {
  // Step 1: Validate we have exactly 15 games
  validateGames(input.last15Games);

  // Step 2: Impute stats for games where player didn't play (Minutes = 0)
  const imputedGames = imputeStats(input.last15Games);

  // Step 3: Extract stat arrays from all 15 games (including imputed)
  const points = imputedGames.map(g => g.points);
  const rebounds = imputedGames.map(g => g.rebounds);
  const assists = imputedGames.map(g => g.assists);

  // Step 4: Evaluate thresholds for each stat
  // THRESHOLDS are already in highest-to-lowest order as per PRD
  const pointsThreshold = evaluateThreshold(points, THRESHOLDS.points);
  const reboundsThreshold = evaluateThreshold(rebounds, THRESHOLDS.rebounds);
  const assistsThreshold = evaluateThreshold(assists, THRESHOLDS.assists);

  // Return prediction output
  return {
    playerId: input.playerId,
    matchId: input.matchId,
    pointsThreshold,       // null if no qualifying threshold
    reboundsThreshold,     // null if no qualifying threshold
    assistsThreshold,      // null if no qualifying threshold
    gamesAnalyzed: 15
  };
}

/**
 * Helper function to check if a player should have predictions disabled
 * Returns true if player is ruled OUT or has insufficient data
 */
export function shouldDisablePrediction(
  games: GameStat[],
  playerStatus?: 'active' | 'out' | 'questionable' | 'doubtful'
): boolean {
  // If player is OUT, disable predictions
  if (playerStatus === 'out') {
    return true;
  }

  // If player has 0 minutes in all games, cannot make prediction
  const playedGames = games.filter(g => g.minutes > 0);
  if (playedGames.length === 0) {
    return true;
  }

  return false;
}
