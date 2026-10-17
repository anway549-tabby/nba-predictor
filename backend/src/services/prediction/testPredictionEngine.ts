/**
 * Prediction Engine Tests (no database, no network)
 *
 * Pins the deterministic rules from the PRD, and the sample-size rule that
 * replaced the old 15-game padding. Run with:
 *
 *   npm run test:engine
 *
 * Exits non-zero on the first failure so it can gate a deploy.
 */

import { generatePrediction, shouldDisablePrediction } from './predictionEngine';
import {
  GameStat,
  THRESHOLDS,
  QUALIFYING_COUNT,
  PREDICTABLE_SEASON_TYPES,
  SEASON_TYPE,
  MIN_REAL_GAMES,
  WINDOW_SIZE
} from '../../types';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

/** Build a 15-game window from per-game point totals. */
function games(points: number[], opts: { minutes?: number[]; rebounds?: number[]; assists?: number[] } = {}): GameStat[] {
  return points.map((p, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    opponent: 'BOS',
    minutes: opts.minutes ? opts.minutes[i] : 30,
    points: p,
    rebounds: opts.rebounds ? opts.rebounds[i] : 0,
    assists: opts.assists ? opts.assists[i] : 0,
    isImputed: false
  }));
}

function run(): void {
  console.log('\n===========================================');
  console.log('Prediction Engine Tests');
  console.log('===========================================\n');

  // --- Thresholds are locked by the PRD ---------------------------------
  console.log('== PRD constants (LOCKED) ==');
  check('points thresholds are 30/25/20/15/10 high->low',
    JSON.stringify(THRESHOLDS.points) === JSON.stringify([30, 25, 20, 15, 10]));
  check('rebounds thresholds are 12/10/8/6/4 high->low',
    JSON.stringify(THRESHOLDS.rebounds) === JSON.stringify([12, 10, 8, 6, 4]));
  check('assists thresholds are 10/8/6/4/2 high->low',
    JSON.stringify(THRESHOLDS.assists) === JSON.stringify([10, 8, 6, 4, 2]));
  check('qualifying count is 14', QUALIFYING_COUNT === 14);

  // --- The 14-of-15 rule ------------------------------------------------
  console.log('\n== 14-of-15 rule ==');

  // 15 games all at 20 -> 20+ qualifies; 25+ does not.
  let out = generatePrediction({
    playerId: 1, matchId: 1, last15Games: games(Array(15).fill(20))
  });
  check('15 games at 20 -> points 20', out.pointsThreshold === 20,
    `got ${out.pointsThreshold}`);

  // Exactly 14 of 15 at or above 20 -> still qualifies (>= 14).
  out = generatePrediction({
    playerId: 1, matchId: 1, last15Games: games([...Array(14).fill(20), 5])
  });
  check('14 of 15 at 20 -> points 20 (boundary, inclusive)', out.pointsThreshold === 20,
    `got ${out.pointsThreshold}`);

  // Only 13 of 15 -> drops to the next threshold that 14 satisfy.
  out = generatePrediction({
    playerId: 1, matchId: 1, last15Games: games([...Array(13).fill(20), 15, 15])
  });
  check('13 of 15 at 20 -> falls back to 15', out.pointsThreshold === 15,
    `got ${out.pointsThreshold}`);

  // Highest qualifying threshold wins, not the lowest.
  out = generatePrediction({
    playerId: 1, matchId: 1, last15Games: games(Array(15).fill(31))
  });
  check('15 games at 31 -> highest threshold 30', out.pointsThreshold === 30,
    `got ${out.pointsThreshold}`);

  // Nothing qualifies -> null, not 0.
  out = generatePrediction({
    playerId: 1, matchId: 1, last15Games: games(Array(15).fill(4))
  });
  check('15 games at 4 points -> no points prop (null)', out.pointsThreshold === null,
    `got ${out.pointsThreshold}`);

  // "15+ means >= 15" — exactly on the line counts.
  out = generatePrediction({
    playerId: 1, matchId: 1, last15Games: games(Array(15).fill(15))
  });
  check('threshold is inclusive: 15 points meets 15+', out.pointsThreshold === 15,
    `got ${out.pointsThreshold}`);

  // --- Window size is a hard invariant ----------------------------------
  console.log('\n== window must be exactly 15 games ==');

  let threw = false;
  try {
    generatePrediction({ playerId: 1, matchId: 1, last15Games: games(Array(14).fill(20)) });
  } catch {
    threw = true;
  }
  check('14 games throws rather than predicting', threw);

  threw = false;
  try {
    generatePrediction({ playerId: 1, matchId: 1, last15Games: games(Array(16).fill(20)) });
  } catch {
    threw = true;
  }
  check('16 games throws rather than predicting', threw);

  // --- Imputation applies to genuine DNPs only --------------------------
  // The PRD rule: minutes = 0 -> impute from games where minutes > 0.
  console.log('\n== imputation (genuine DNPs) ==');

  // 13 games at 20, 2 DNPs. Average of played games is 20, so the imputed
  // games also read 20 and the player still qualifies at 20+.
  out = generatePrediction({
    playerId: 1,
    matchId: 1,
    last15Games: games(
      [...Array(13).fill(20), 0, 0],
      { minutes: [...Array(13).fill(30), 0, 0] }
    )
  });
  check('2 DNPs imputed from a 20-point average -> points 20', out.pointsThreshold === 20,
    `got ${out.pointsThreshold}`);

  // A DNP must not be read as a literal 0 — that would sink the threshold.
  out = generatePrediction({
    playerId: 1,
    matchId: 1,
    last15Games: games(
      [...Array(14).fill(20), 0],
      { minutes: [...Array(14).fill(30), 0] }
    )
  });
  check('a DNP is imputed, not counted as 0 points', out.pointsThreshold === 20,
    `got ${out.pointsThreshold}`);

  // THE REGRESSION THIS FILE EXISTS FOR
  //
  // The engine itself cannot tell a small sample from a large one: every
  // imputed value is a copy of the player's mean, so padding a 1-game sample
  // yields 15 identical values and "14 of 15" passes on that single game.
  // This is why the floor lives in predictionService (MIN_REAL_GAMES), not
  // here. The test pins the engine's behaviour so nobody concludes the engine
  // is already safe and removes the service-level guard.
  out = generatePrediction({
    playerId: 1,
    matchId: 1,
    last15Games: games(
      [30, ...Array(14).fill(0)],
      { minutes: [30, ...Array(14).fill(0)] }
    )
  });
  check(
    'engine alone WOULD fabricate 30+ from one game — hence MIN_REAL_GAMES in the service',
    out.pointsThreshold === 30,
    `got ${out.pointsThreshold}`
  );

  // --- The real-game floor ----------------------------------------------
  console.log('\n== real-game floor (rookies / low-minute players) ==');

  check('floor is 8 real games', MIN_REAL_GAMES === 8, `got ${MIN_REAL_GAMES}`);
  check('window is 15', WINDOW_SIZE === 15, `got ${WINDOW_SIZE}`);
  check('floor is below the window, so imputation is reachable',
    MIN_REAL_GAMES < WINDOW_SIZE);
  check('floor is high enough that imputed values cannot outnumber real ones',
    MIN_REAL_GAMES > WINDOW_SIZE - MIN_REAL_GAMES,
    `${MIN_REAL_GAMES} real vs ${WINDOW_SIZE - MIN_REAL_GAMES} imputed`);

  // At the floor: 8 real games + 7 imputed. A consistent 20-point scorer
  // should still earn the 20+ prop — this is the rookie case working.
  out = generatePrediction({
    playerId: 1,
    matchId: 1,
    last15Games: games(
      [...Array(8).fill(20), ...Array(7).fill(0)],
      { minutes: [...Array(8).fill(30), ...Array(7).fill(0)] }
    )
  });
  check('8 real games at 20 + 7 imputed -> points 20 (rookie qualifies)',
    out.pointsThreshold === 20, `got ${out.pointsThreshold}`);

  // At the floor, one bad real game out of 8 breaks it: 7 real + 7 imputed
  // clear the bar but that is 14 of 15 only if the mean also clears it.
  // mean of [20 x7, 2] = round(17.75) = 18, which clears 15 but not 20.
  out = generatePrediction({
    playerId: 1,
    matchId: 1,
    last15Games: games(
      [...Array(7).fill(20), 2, ...Array(7).fill(0)],
      { minutes: [...Array(7).fill(30), 30, ...Array(7).fill(0)] }
    )
  });
  check('an inconsistent 8-game sample drops to a lower threshold, not 20',
    out.pointsThreshold === 15, `got ${out.pointsThreshold}`);

  // --- Per-stat independence --------------------------------------------
  console.log('\n== stats are evaluated independently ==');

  out = generatePrediction({
    playerId: 1,
    matchId: 1,
    last15Games: games(Array(15).fill(20), {
      rebounds: Array(15).fill(9),
      assists: Array(15).fill(1)
    })
  });
  check('points 20 / rebounds 8 / assists null',
    out.pointsThreshold === 20 && out.reboundsThreshold === 8 && out.assistsThreshold === null,
    `got ${out.pointsThreshold}/${out.reboundsThreshold}/${out.assistsThreshold}`);
  check('gamesAnalyzed is always 15', out.gamesAnalyzed === 15);

  // --- Ruled-out players -------------------------------------------------
  console.log('\n== ruled-out / no-data players ==');

  check('status "out" disables prediction',
    shouldDisablePrediction(games(Array(15).fill(20)), 'out') === true);
  check('status "active" does not disable',
    shouldDisablePrediction(games(Array(15).fill(20)), 'active') === false);
  check('all-zero-minutes window disables prediction',
    shouldDisablePrediction(games(Array(15).fill(0), { minutes: Array(15).fill(0) })) === true);

  // --- Season scope ------------------------------------------------------
  console.log('\n== season scope (regular season + playoffs only) ==');

  check('regular season is predictable',
    PREDICTABLE_SEASON_TYPES.includes(SEASON_TYPE.REGULAR));
  check('playoffs are predictable',
    PREDICTABLE_SEASON_TYPES.includes(SEASON_TYPE.POSTSEASON));
  check('preseason is NOT predictable',
    !PREDICTABLE_SEASON_TYPES.includes(SEASON_TYPE.PRESEASON));
  check('play-in is NOT predictable (decided 2026-10-17 — not regular season or playoffs)',
    !PREDICTABLE_SEASON_TYPES.includes(SEASON_TYPE.PLAY_IN));
  check('an unknown (null) season type is NOT predictable',
    !PREDICTABLE_SEASON_TYPES.includes(null as unknown as number));
  check('exactly two season types are predictable',
    PREDICTABLE_SEASON_TYPES.length === 2,
    `got ${PREDICTABLE_SEASON_TYPES.length}: ${PREDICTABLE_SEASON_TYPES.join(', ')}`);

  // --- Summary -----------------------------------------------------------
  console.log('\n----------------------------------------');
  console.log(`${passed} passed, ${failed} failed`);
  console.log('----------------------------------------\n');

  if (failed > 0) process.exit(1);
}

run();
