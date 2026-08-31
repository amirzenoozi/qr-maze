import { generateQrMatrix } from '../qr/generate';
import { buildReservedMask, countCarvableModules } from '../qr/reserved';
import { EC_DAMAGE_BUDGET, EC_LEVELS, type ErrorCorrectionLevel } from '../qr/types';
import { verifyDecodes } from '../qr/verify';
import { hashString, mulberry32 } from '../random';
import { analyzeMaze } from './analyze';
import {
  carveFromBorder,
  carveThroughWaypoints,
  chooseExit,
  plugMaze,
  widenMaze,
  type CarveResult,
} from './carve';
import {
  CANONICAL_MIX,
  DEFAULT_DIFFICULTY,
  DIFFICULTY_CONFIG,
  STRUCTURE_MINIMUM,
  STRUCTURE_SAFETY,
  STRUCTURE_TARGET,
  moveBudget,
  type Difficulty,
} from './difficulty';
import type { Maze, Point } from './types';

/** Why a candidate error-correction level was rejected, if it was. */
export type AttemptOutcome =
  | 'accepted'
  | 'no-corridor'
  | 'over-damage-budget'
  | 'insufficient-headroom'
  | 'decode-failed'
  | 'unsolvable';

/** Diagnostic record of one error-correction level attempt. */
export interface MazeBuildAttempt {
  readonly level: ErrorCorrectionLevel;
  readonly version: number;
  readonly size: number;
  readonly carvedCount: number;
  readonly pluggedCount: number;
  /** Altered modules as a fraction of the alterable (non-function) area. */
  readonly damageRatio: number;
  readonly outcome: AttemptOutcome;
}

export type MazeBuildResult =
  | { readonly ok: true; readonly maze: Maze; readonly attempts: MazeBuildAttempt[] }
  | { readonly ok: false; readonly reason: string; readonly attempts: MazeBuildAttempt[] };

/** Merge two change masks into a fresh one. */
function union(left: Uint8Array, right: Uint8Array): Uint8Array {
  const merged = Uint8Array.from(left);
  for (let cell = 0; cell < merged.length; cell++) {
    if (right[cell] === 1) merged[cell] = 1;
  }
  return merged;
}

/** How an allowance is split between opening walls and raising them. */
interface EditMix {
  readonly widen: number;
  readonly plug: number;
}

/** A board with the tier's structural edits applied at some scale. */
interface Structured {
  readonly modules: Uint8Array;
  readonly carved: Uint8Array;
  readonly carvedCount: number;
  readonly plugged: Uint8Array;
  readonly pluggedCount: number;
}

/**
 * Apply `scale` structural edits, split between widening and plugging.
 *
 * The PRNG is rebuilt from the same seed on every call, so the candidate order
 * is fixed and a larger scale opens a superset of a smaller one. That is what
 * makes the result monotonic enough to binary-search.
 */
function applyStructure(
  size: number,
  reserved: Uint8Array,
  carve: CarveResult,
  start: Point,
  end: Point,
  mix: EditMix,
  scale: number,
  seed: number,
): Structured {
  const widened = widenMaze(
    size,
    carve.modules,
    reserved,
    start,
    Math.round(scale * mix.widen),
    mulberry32(seed),
  );
  const opened = union(carve.carved, widened.changed);

  const filled = plugMaze(
    size,
    widened.modules,
    reserved,
    opened,
    start,
    end,
    Math.round(scale * mix.plug),
    mulberry32(seed ^ 0x9e3779b9),
  );

  return {
    modules: filled.modules,
    carved: opened,
    carvedCount: carve.carvedCount + widened.changedCount,
    plugged: filled.changed,
    pluggedCount: filled.changedCount,
  };
}

/**
 * Build the cheapest playable maze for `url` at the requested difficulty.
 *
 * Error-correction level is escalated L -> M -> Q -> H and the first level that
 * satisfies every requirement wins. Raising the level does not itself open
 * routes — QR data masking is effectively random, so a raw symbol almost never
 * contains a natural corridor. What a higher level buys is a larger *damage
 * budget*, i.e. permission to alter more modules and still decode.
 *
 * A level is accepted only when all of the following hold:
 *  1. a corridor exists from the exit to some cell on the top or left border,
 *     without darkening or opening a function pattern;
 *  2. the corridor stays inside that level's nominal damage budget;
 *  3. the level has enough measured headroom for the structural edits;
 *  4. a real decoder still reads the finished matrix back as `url`;
 *  5. the maze is actually solvable.
 *
 * Difficulty is applied *inside* that envelope, never around it. The corridor
 * is bent through waypoints, then whatever budget is left over is split
 * between widening and plugging — so a harder board spends the symbol's spare
 * error correction rather than asking for more of it.
 */
/**
 * Carve a corridor, dropping a waypoint at a time until one fits the budget.
 *
 * A cheaper route at the same level keeps the symbol the size the player
 * expects; escalating would grow it and change the board entirely.
 */
function routeCarve(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  start: Point,
  end: Point,
  maxDamage: number,
  waypoints: number,
  random?: () => number,
): CarveResult | null {
  for (let count = waypoints; count >= 0; count--) {
    const candidate =
      count === 0
        ? carveFromBorder(size, modules, reserved, end, random)
        : carveThroughWaypoints(size, modules, reserved, start, end, count, random);
    if (candidate && candidate.carvedCount <= maxDamage) return candidate;
  }
  return null;
}

export function buildMaze(
  url: string,
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
  variant = 0,
  levels = EC_LEVELS,
): MazeBuildResult {
  const attempts: MazeBuildAttempt[] = [];
  const config = DIFFICULTY_CONFIG[difficulty];

  // Fixed once, from the smallest symbol that can hold the payload. Deriving
  // it per level would raise the bar every time we escalated to clear it, so
  // the search could chase its own target all the way to H.
  const base = generateQrMatrix(url, levels[0]);
  const baseCarvable = countCarvableModules(buildReservedMask(base.size, base.version));
  const want = Math.max(STRUCTURE_MINIMUM, Math.ceil(baseCarvable * STRUCTURE_TARGET));

  for (const level of levels) {
    const qr = generateQrMatrix(url, level);
    const reserved = buildReservedMask(qr.size, qr.version);
    const carvable = countCarvableModules(reserved);
    const maxDamage = Math.floor(carvable * EC_DAMAGE_BUDGET[level]);

    const record = (outcome: AttemptOutcome, carved: number, plugs: number): void => {
      attempts.push({
        level,
        version: qr.version,
        size: qr.size,
        carvedCount: carved,
        pluggedCount: plugs,
        damageRatio: carvable === 0 ? 1 : (carved + plugs) / carvable,
        outcome,
      });
    };

    const end = chooseExit(qr.size);

    // One direct carve settles where the start goes. Its route is discarded
    // when waypoints are in play, but the border anchor it found still stands:
    // reachability does not change when extra modules are opened.
    // The variant only re-rolls which of the equally cheap routes is taken,
    // so a rebuilt board costs the decoder the same and starts in the same
    // corner. It is threaded in rather than stored: the caller passes a clock
    // reading, and nothing has to remember what anyone has already played.
    const route = mulberry32(hashString(`${url}|${level}|${variant}`));

    const anchor = carveFromBorder(qr.size, qr.modules, reserved, end, route);
    if (!anchor) {
      record('no-corridor', 0, 0);
      continue;
    }
    const start = anchor.start;

    const carve = routeCarve(
      qr.size, qr.modules, reserved, start, end, maxDamage, config.waypoints, route,
    );

    if (!carve) {
      record('over-damage-budget', anchor.carvedCount, 0);
      continue;
    }

    // The corridor alone must survive a decode before anything is built on it.
    if (!verifyDecodes(carve.modules, qr.size, url)) {
      record('decode-failed', carve.carvedCount, 0);
      continue;
    }

    // Seeded from the URL, the level and the variant — deliberately not the
    // tier. The level measured below then comes out the same whichever tier
    // asked, so difficulty never resizes the code; and because the candidate
    // order is shared, Easy's extra openings are a superset of Normal's, so
    // the tiers read as one maze at different generosity rather than four
    // unrelated boards. Holding the variant fixed reproduces a board exactly.
    const seed = hashString(`${url}|${level}|${variant}`);

    // The probe below runs against one canonical board that no variant ever
    // plays: the unshuffled route under the unshuffled seed. The level it
    // settles on is then a property of the URL and the tier alone. Measuring
    // the variant's own board instead let a link sitting on the boundary
    // between two levels flip size between plays, which moved the board size
    // and the move count, not just the route. Equal-cost routes damage the
    // symbol equally, so one reading holds for all of them.
    const probeSeed = hashString(`${url}|${level}`);
    const probeCarve = routeCarve(
      qr.size, qr.modules, reserved, start, end, maxDamage, config.waypoints,
    );
    if (!probeCarve) {
      record('over-damage-budget', carve.carvedCount, 0);
      continue;
    }

    // Measure, do not estimate. A percentage-of-modules budget badly
    // overstates what scattered edits cost: Reed-Solomon repairs whole
    // codewords, so eight modules spread across the symbol can spend eight
    // times what eight adjacent ones do. The only trustworthy answer comes
    // from running a real decoder, and at a few milliseconds a go we can
    // afford to bisect for it.
    const decodes = (scale: number): boolean =>
      verifyDecodes(
        applyStructure(qr.size, reserved, probeCarve, start, end, CANONICAL_MIX, scale, probeSeed)
          .modules,
        qr.size,
        url,
      );

    let low = 0;
    let high = Math.ceil(want / STRUCTURE_SAFETY) + 1;
    while (low + 1 < high) {
      const mid = (low + high) >> 1;
      if (decodes(mid)) low = mid;
      else high = mid;
    }

    const spend = Math.min(want, Math.floor(low * STRUCTURE_SAFETY));
    const structured = applyStructure(
      qr.size, reserved, carve, start, end, config, spend, seed,
    );

    // Short of what the tier asked for: a denser symbol has more error
    // correction to lend, so try the next level before settling.
    const lastLevel = level === levels[levels.length - 1];
    if (spend < want && !lastLevel) {
      record('insufficient-headroom', structured.carvedCount, structured.pluggedCount);
      continue;
    }

    const { modules, carved: carvedMask, carvedCount, plugged: pluggedMask, pluggedCount } =
      structured;

    if (!verifyDecodes(modules, qr.size, url)) {
      record('decode-failed', carvedCount, pluggedCount);
      continue;
    }

    const analysis = analyzeMaze(qr.size, modules, start, end);
    if (!analysis.solvable || analysis.shortestLength === null) {
      record('unsolvable', carvedCount, pluggedCount);
      continue;
    }

    record('accepted', carvedCount, pluggedCount);

    return {
      ok: true,
      attempts,
      maze: {
        size: qr.size,
        version: qr.version,
        level,
        url,
        modules,
        reserved,
        carved: carvedMask,
        carvedCount,
        plugged: pluggedMask,
        pluggedCount,
        start,
        end,
        analysis,
        difficulty,
        moveBudget: moveBudget(analysis.shortestLength, difficulty),
      },
    };
  }

  return {
    ok: false,
    attempts,
    reason: 'No error-correction level produced a scannable, solvable maze.',
  };
}
