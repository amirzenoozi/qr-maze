import { idx, inBounds } from '../qr/types';
import { DIRECTIONS, type Point } from './types';

/**
 * Cost of stepping onto a module, or `null` if the step is illegal.
 *
 * The rule mirrors how the player actually moves: **any light module is
 * walkable**, whether or not it belongs to a function pattern. Reserved
 * modules simply cannot be *modified*, so a dark one is a permanent wall.
 *
 * This matters more than it looks. The timing patterns are a full row and a
 * full column of function modules, so treating all reserved modules as
 * impassable would seal the symbol into disconnected quadrants and strand the
 * start deep inside the largest one. Letting the search cross at the light
 * cells of a timing pattern — or slip along the light separator around a
 * finder — makes the whole symbol a single graph.
 */
function stepCost(modules: Uint8Array, reserved: Uint8Array, cell: number): number | null {
  if (modules[cell] === 0) return 0;
  // Dark and unmodifiable: a wall for good.
  if (reserved[cell] === 1) return null;
  // Dark but ours to carve.
  return 1;
}

interface Search {
  /** Total carve cost of the cheapest route from the source, or -1. */
  readonly dist: Int32Array;
  /** Predecessor on that route, or -1. */
  readonly prev: Int32Array;
}

/**
 * Cheapest-route search from a single source.
 *
 * Node weights are 0 (already light) or 1 (needs carving), so a bucket queue
 * (Dial's algorithm) resolves this in linear time and yields a provably
 * minimal number of altered modules — which is what keeps the symbol inside
 * its error-correction budget.
 *
 * Costs are symmetric: the total is the sum of the weights of the nodes on the
 * route, so a search from either endpoint gives the same answer.
 */
function searchFrom(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  source: number,
): Search {
  const n = size * size;
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);

  const sourceCost = stepCost(modules, reserved, source);
  if (sourceCost === null) return { dist, prev };

  // buckets[d] holds cells discovered at cost d.
  const buckets: number[][] = [];
  const push = (cost: number, cell: number): void => {
    (buckets[cost] ??= []).push(cell);
  };

  dist[source] = sourceCost;
  push(sourceCost, source);

  for (let cost = 0; cost < buckets.length; cost++) {
    const bucket = buckets[cost];
    if (!bucket) continue;

    // `bucket.length` is re-read each pass: relaxing a free (0-cost) edge
    // appends to the bucket currently being drained.
    for (let i = 0; i < bucket.length; i++) {
      const cell = bucket[i];
      // Skip entries superseded by a cheaper route found later.
      if (dist[cell] !== cost) continue;

      const row = (cell / size) | 0;
      const col = cell % size;

      for (const [dr, dc] of DIRECTIONS) {
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(size, nr, nc)) continue;

        const next = idx(size, nr, nc);
        const weight = stepCost(modules, reserved, next);
        if (weight === null) continue;

        const nextCost = cost + weight;
        if (dist[next] !== -1 && dist[next] <= nextCost) continue;

        dist[next] = nextCost;
        prev[next] = cell;
        push(nextCost, next);
      }
    }
  }

  return { dist, prev };
}

export interface CarveResult {
  /** Post-carve modules: `1` = wall, `0` = path. */
  readonly modules: Uint8Array;
  /** Mask of modules flipped from wall to path. */
  readonly carved: Uint8Array;
  /** How many modules had to be flipped. */
  readonly carvedCount: number;
}

/** Walk the predecessor chain and open every dark module along it. */
function carveRoute(
  modules: Uint8Array,
  prev: Int32Array,
  from: number,
  to: number,
): CarveResult {
  const carvedModules = Uint8Array.from(modules);
  const carved = new Uint8Array(modules.length);
  let carvedCount = 0;

  for (let cell = from; cell !== -1; cell = prev[cell]) {
    // Reserved modules on a route are always light (`stepCost` refuses dark
    // ones), so this can never damage a function pattern.
    if (carvedModules[cell] === 1) {
      carvedModules[cell] = 0;
      carved[cell] = 1;
      carvedCount++;
    }
    if (cell === to) break;
  }

  return { modules: carvedModules, carved, carvedCount };
}

/**
 * Open the *cheapest possible* corridor between two known cells.
 *
 * @returns The carved matrix, or `null` if no legal corridor exists.
 */
export function carveCheapestPath(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  start: Point,
  end: Point,
): CarveResult | null {
  const startCell = idx(size, start.row, start.col);
  const endCell = idx(size, end.row, end.col);

  const { dist, prev } = searchFrom(size, modules, reserved, startCell);
  if (dist[endCell] === -1) return null;

  return carveRoute(modules, prev, endCell, startCell);
}

/**
 * The exit: the bottom-right corner of the symbol.
 *
 * A QR code has only three finder patterns, so unlike the other three corners
 * this one is ordinary data — always free to carve, and the natural
 * counterpart to a start on the top or left border.
 */
export function chooseExit(size: number): Point {
  return { row: size - 1, col: size - 1 };
}

export interface BorderCarveResult extends CarveResult {
  /** The border cell the corridor was anchored to. */
  readonly start: Point;
}

/**
 * Open a corridor from the exit to the reachable cell on the **top or left
 * border** that lies nearest the top-left corner.
 *
 * Anchoring the two ends to opposite corners is what gives the maze its
 * length: the player crosses the full diagonal instead of cutting in from
 * wherever the corridor happened to be cheapest.
 *
 * Note that the literal corner is unavailable. Cells `(0,0)`-`(0,6)` and
 * `(0,0)`-`(6,0)` are the top-left finder pattern's outer ring — dark and
 * unmodifiable — so the nearest legal starts are `(0,7)` and `(7,0)` on the
 * light separator that surrounds it.
 *
 * Proximity to the corner outranks carve cost here, so this deliberately
 * spends more of the error-correction budget than the cheapest anchor would.
 * `buildMaze` still gates the result on that budget and escalates the level if
 * the corridor turns out too expensive.
 *
 * The search runs once from the exit, which yields the cost of every border
 * cell simultaneously.
 */
export function carveFromBorder(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  end: Point,
): BorderCarveResult | null {
  const endCell = idx(size, end.row, end.col);
  const { dist, prev } = searchFrom(size, modules, reserved, endCell);

  let bestCell = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  let bestCorner = Number.POSITIVE_INFINITY;

  const consider = (row: number, col: number): void => {
    const cell = idx(size, row, col);
    if (cell === endCell || dist[cell] === -1) return;

    const cost = dist[cell];
    // Border cells all have row 0 or column 0, so `row + col` is simply how
    // far along the border the cell sits from the top-left corner. Minimising
    // it maximises the diagonal the player has to cross; carve cost only
    // separates the two candidates that tie at the same distance.
    const corner = row + col;
    if (corner < bestCorner || (corner === bestCorner && cost < bestCost)) {
      bestCost = cost;
      bestCorner = corner;
      bestCell = cell;
    }
  };

  for (let col = 0; col < size; col++) consider(0, col);
  for (let row = 1; row < size; row++) consider(row, 0);

  if (bestCell === -1) return null;

  return {
    ...carveRoute(modules, prev, bestCell, endCell),
    start: { row: (bestCell / size) | 0, col: bestCell % size },
  };
}
