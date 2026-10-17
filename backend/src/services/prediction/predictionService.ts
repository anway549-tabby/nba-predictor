/**
 * Prediction Service
 *
 * Database-aware wrapper for prediction engine
 * Generates predictions for all players in a match and saves to database
 */

import pool from '../../config/database';
import { generatePrediction } from './predictionEngine';
import { GameStat, PREDICTABLE_SEASON_TYPES, MIN_REAL_GAMES, WINDOW_SIZE } from '../../types';

/**
 * Thrown when a match is not eligible for predictions at all (preseason or
 * unknown season type). Distinct from an error, so callers can skip quietly.
 */
export class MatchNotPredictableError extends Error {
  constructor(matchId: number, seasonType: number | null) {
    super(
      `Match ${matchId} is not predictable (season_type=${seasonType ?? 'unknown'}). ` +
      `Only regular season (2) and playoffs (3) are predicted.`
    );
    this.name = 'MatchNotPredictableError';
  }
}

export interface PlayerPrediction {
  playerId: number;
  playerName: string;
  team: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  gamesAnalyzed: number;
}

/**
 * Generate predictions for all players in a match
 *
 * @param matchId - Database match ID
 * @returns Array of predictions with player details
 */
export async function generatePredictionsForMatch(matchId: number): Promise<PlayerPrediction[]> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get match information
    const matchResult = await client.query(
      `SELECT
         m.id,
         m.game_time,
         m.status,
         m.season_type,
         m.home_team_id,
         m.away_team_id
       FROM matches m
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      throw new Error(`Match ${matchId} not found`);
    }

    const match = matchResult.rows[0];

    // Only regular season and playoff games are predicted. Preseason
    // ("practice") games are explicitly out of scope, and a NULL season_type
    // means we have not confirmed what the game is — so it is not predicted
    // either. Fail before touching rosters so nothing is written.
    if (!PREDICTABLE_SEASON_TYPES.includes(match.season_type)) {
      await client.query('ROLLBACK');
      throw new MatchNotPredictableError(matchId, match.season_type);
    }

    // Get all players from both teams
    const playersResult = await client.query(
      `SELECT DISTINCT p.id, p.first_name, p.last_name, t.abbreviation as team
       FROM players p
       JOIN teams t ON p.current_team_id = t.id
       WHERE t.id = $1 OR t.id = $2`,
      [match.home_team_id, match.away_team_id]
    );

    if (playersResult.rows.length === 0) {
      console.log(`⚠️  No players found for match ${matchId}`);
      await client.query('COMMIT');
      return [];
    }

    // Generate predictions for each player
    const predictions: PlayerPrediction[] = [];

    for (const player of playersResult.rows) {
      try {
        // Get the player's last 15 QUALIFYING games.
        //
        // Qualifying means a real NBA regular-season or playoff game:
        //   - m.season_type IN (2, 3)  excludes preseason ("practice") games.
        //   - both teams are real NBA franchises. This is what excludes the
        //     All-Star Game: ESPN labels the 2026 All-Star events (WORLD /
        //     STARS / STRIPES) as season_type 2 "regular-season", so the
        //     season_type filter alone would let them through.
        //
        // These are the player's own APPEARANCES, not his team's fixtures: a
        // DNP is never stored (parseESPNPlayerStats skips athletes with no
        // stat line), so the window is the games he actually played. They need
        // not be consecutive team games.
        //
        // Deliberately NOT filtered by season or by team: the window is the
        // player's complete history, and crossing a season boundary or a trade
        // is fine — a traded player's games for his previous team still count.
        // Whichever qualifying appearances are most recent are the window.
        const statsResult = await client.query(
          `SELECT
             pgs.game_date as date,
             opp.abbreviation as opponent,
             pgs.minutes_played as minutes,
             pgs.points,
             pgs.rebounds,
             pgs.assists
           FROM player_game_stats pgs
           JOIN teams opp ON pgs.opponent_team_id = opp.id
           JOIN teams own ON pgs.team_id = own.id
           JOIN matches m ON pgs.match_id = m.id
           WHERE pgs.player_id = $1
             AND m.season_type = ANY($2::int[])
             AND opp.abbreviation IN ('ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GS',
                                      'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NO','NY',
                                      'OKC','ORL','PHI','PHX','POR','SA','SAC','TOR','UTAH','WSH')
             AND own.abbreviation IN ('ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GS',
                                      'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NO','NY',
                                      'OKC','ORL','PHI','PHX','POR','SA','SAC','TOR','UTAH','WSH')
           ORDER BY pgs.game_date DESC
           LIMIT $3`,
          [player.id, PREDICTABLE_SEASON_TYPES, WINDOW_SIZE]
        );

        // At least MIN_REAL_GAMES games the player actually appeared in.
        //
        // Below the floor there is no prediction at all. Imputed values are
        // all copies of the player's own mean, so they clear or fail a
        // threshold as one block — with 1 real game the other 14 are copies of
        // it and "14 of 15" passes on a single game. The floor is what makes
        // the remaining imputation safe; see MIN_REAL_GAMES for why it is 8.
        const realGameCount = statsResult.rows.length;

        if (realGameCount < MIN_REAL_GAMES) {
          console.log(
            `  ⏩ Skipping ${player.first_name} ${player.last_name} - ` +
            `only ${realGameCount} real game(s), need ${MIN_REAL_GAMES}`
          );
          continue;
        }

        const realGames: GameStat[] = statsResult.rows.map((row: any) => ({
          date: row.date,
          opponent: row.opponent,
          minutes: row.minutes,
          points: row.points,
          rebounds: row.rebounds,
          assists: row.assists,
          isImputed: false
        }));

        // Pad up to the window with 0-minute entries. The engine imputes those
        // from the player's own average (the PRD's Minutes = 0 rule), and
        // marks them isImputed. Only reached when realGameCount is between the
        // floor and the window size.
        const last15Games: GameStat[] = realGames.length >= WINDOW_SIZE
          ? realGames
          : [
              ...realGames,
              ...Array.from({ length: WINDOW_SIZE - realGames.length }, () => ({
                date: realGames[realGames.length - 1].date,
                opponent: 'N/A',
                minutes: 0,
                points: 0,
                rebounds: 0,
                assists: 0,
                isImputed: false
              }))
            ];

        if (realGameCount < WINDOW_SIZE) {
          console.log(
            `  ℹ️  ${player.first_name} ${player.last_name}: ` +
            `${realGameCount} real + ${WINDOW_SIZE - realGameCount} imputed`
          );
        }

        // Generate prediction using prediction engine
        const prediction = generatePrediction({
          playerId: player.id,
          matchId: matchId,
          last15Games
        });

        // Check if prediction already exists
        const existingPred = await client.query(
          'SELECT id FROM predictions WHERE player_id = $1 AND match_id = $2',
          [player.id, matchId]
        );

        if (existingPred.rows.length > 0) {
          // Update existing prediction
          await client.query(
            `UPDATE predictions
             SET points_threshold = $1,
                 rebounds_threshold = $2,
                 assists_threshold = $3,
                 games_analyzed = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE player_id = $5 AND match_id = $6`,
            [
              prediction.pointsThreshold,
              prediction.reboundsThreshold,
              prediction.assistsThreshold,
              prediction.gamesAnalyzed,
              player.id,
              matchId
            ]
          );
        } else {
          // Insert new prediction
          await client.query(
            `INSERT INTO predictions (
               player_id, match_id, points_threshold, rebounds_threshold,
               assists_threshold, games_analyzed
             )
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              player.id,
              matchId,
              prediction.pointsThreshold,
              prediction.reboundsThreshold,
              prediction.assistsThreshold,
              prediction.gamesAnalyzed
            ]
          );
        }

        // Add to results
        predictions.push({
          playerId: player.id,
          playerName: `${player.first_name} ${player.last_name}`,
          team: player.team,
          points: prediction.pointsThreshold,
          rebounds: prediction.reboundsThreshold,
          assists: prediction.assistsThreshold,
          gamesAnalyzed: prediction.gamesAnalyzed
        });

      } catch (error) {
        console.error(`  ❌ Error generating prediction for ${player.first_name} ${player.last_name}:`, error);
        // Continue with other players
      }
    }

    await client.query('COMMIT');
    return predictions;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
