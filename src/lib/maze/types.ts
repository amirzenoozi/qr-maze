import type { ErrorCorrectionLevel } from '../qr/types';
import type { Difficulty } from './difficulty';

/** A cell coordinate inside the module matrix. */
export interface Point {
  readonly row: number;
  readonly col: number;
}

/** The four orthogonal moves available to the player. */
export const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Result of inspecting a finished maze for playability. */
export interface MazeAnalysis {
  /** Whether the exit can be reached from the start at all. */
  readonly solvable: boolean;
  /** Number of moves along a shortest route, or `null` when unsolvable. */
  readonly shortestLength: number | null;
  /**
   * How many *distinct shortest* routes reach the exit.
   * Saturates at `ROUTE_COUNT_CAP` to keep the count cheap and bounded.
   */
  readonly shortestRouteCount: number;
  /** True when `shortestRouteCount` hit the cap and is a lower bound. */
  readonly routeCountSaturated: boolean;
  /** Total open cells reachable from the start, including the start itself. */
  readonly reachableCells: number;
}

/**
 * Upper bound on the reported route count. Counting is exact below this value;
 * beyond it the number is clamped so arithmetic stays within safe integers.
 */
export const ROUTE_COUNT_CAP = 1_000_000_000;

/** A fully built, playable maze derived from a QR symbol. */
export interface Maze {
  /** Width/height of the matrix in cells. */
  readonly size: number;
  readonly version: number;
  readonly level: ErrorCorrectionLevel;
  /** The payload the symbol encodes. */
  readonly url: string;
  /** Row-major cells: `1` = wall (dark module), `0` = walkable path. */
  readonly modules: Uint8Array;
  /** Row-major mask: `1` = QR function pattern, never carved. */
  readonly reserved: Uint8Array;
  /** Row-major mask: `1` = module flipped from wall to path by carving. */
  readonly carved: Uint8Array;
  /** Number of modules the carver had to open. */
  readonly carvedCount: number;
  /** Row-major mask: `1` = light module filled in to prune a route. */
  readonly plugged: Uint8Array;
  /** Number of modules filled in. Counts against the same damage budget. */
  readonly pluggedCount: number;
  readonly start: Point;
  readonly end: Point;
  readonly analysis: MazeAnalysis;
  /** The tier this board was generated for. */
  readonly difficulty: Difficulty;
  /** Moves allowed before the run is lost. */
  readonly moveBudget: number;
}
