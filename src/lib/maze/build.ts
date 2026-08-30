import { generateQrMatrix } from '../qr/generate';
import { buildReservedMask, countCarvableModules } from '../qr/reserved';
import { EC_DAMAGE_BUDGET, EC_LEVELS, type ErrorCorrectionLevel } from '../qr/types';
import { verifyDecodes } from '../qr/verify';
import { analyzeMaze } from './analyze';
import { carveFromBorder, chooseExit } from './carve';
import type { Maze } from './types';

/** Why a candidate error-correction level was rejected, if it was. */
export type AttemptOutcome =
  | 'accepted'
  | 'no-corridor'
  | 'over-damage-budget'
  | 'decode-failed'
  | 'unsolvable';

/** Diagnostic record of one error-correction level attempt. */
export interface MazeBuildAttempt {
  readonly level: ErrorCorrectionLevel;
  readonly version: number;
  readonly size: number;
  readonly carvedCount: number;
  /** Carved modules as a fraction of the alterable (non-function) area. */
  readonly damageRatio: number;
  readonly outcome: AttemptOutcome;
}

export type MazeBuildResult =
  | { readonly ok: true; readonly maze: Maze; readonly attempts: MazeBuildAttempt[] }
  | { readonly ok: false; readonly reason: string; readonly attempts: MazeBuildAttempt[] };

/**
 * Build the cheapest playable maze for `url`.
 *
 * Error-correction level is escalated L -> M -> Q -> H and the first level that
 * satisfies every requirement wins. Raising the level does not itself open
 * routes — QR data masking is effectively random, so a raw symbol almost never
 * contains a natural corridor. What a higher level buys is a larger *damage
 * budget*, i.e. permission to carve more modules and still decode.
 *
 * A level is accepted only when all of the following hold:
 *  1. a corridor exists from the exit to some cell on the top or left border,
 *     without darkening or opening a function pattern;
 *  2. the carved modules stay inside that level's nominal damage budget;
 *  3. a real decoder still reads the carved matrix back as `url`;
 *  4. the finished maze is actually solvable.
 */
export function buildMaze(url: string, levels = EC_LEVELS): MazeBuildResult {
  const attempts: MazeBuildAttempt[] = [];

  for (const level of levels) {
    const qr = generateQrMatrix(url, level);
    const reserved = buildReservedMask(qr.size, qr.version);
    const carvable = countCarvableModules(reserved);

    const record = (
      outcome: AttemptOutcome,
      carvedCount: number,
    ): MazeBuildAttempt => {
      const attempt: MazeBuildAttempt = {
        level,
        version: qr.version,
        size: qr.size,
        carvedCount,
        damageRatio: carvable === 0 ? 1 : carvedCount / carvable,
        outcome,
      };
      attempts.push(attempt);
      return attempt;
    };

    const end = chooseExit(qr.size);
    const carve = carveFromBorder(qr.size, qr.modules, reserved, end);
    if (!carve) {
      record('no-corridor', 0);
      continue;
    }

    const { start } = carve;

    const damageRatio = carvable === 0 ? 1 : carve.carvedCount / carvable;
    if (damageRatio > EC_DAMAGE_BUDGET[level]) {
      record('over-damage-budget', carve.carvedCount);
      continue;
    }

    if (!verifyDecodes(carve.modules, qr.size, url)) {
      record('decode-failed', carve.carvedCount);
      continue;
    }

    const analysis = analyzeMaze(qr.size, carve.modules, start, end);
    if (!analysis.solvable) {
      record('unsolvable', carve.carvedCount);
      continue;
    }

    record('accepted', carve.carvedCount);

    return {
      ok: true,
      attempts,
      maze: {
        size: qr.size,
        version: qr.version,
        level,
        url,
        modules: carve.modules,
        reserved,
        carved: carve.carved,
        carvedCount: carve.carvedCount,
        start,
        end,
        analysis,
      },
    };
  }

  return {
    ok: false,
    attempts,
    reason: 'No error-correction level produced a scannable, solvable maze.',
  };
}
