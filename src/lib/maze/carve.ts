import { idx, inBounds } from '../qr/types';
import { shuffle } from '../random';
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
  random?: () => number,
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

  // Most of this grid costs nothing to cross, so a huge number of routes tie
  // for cheapest and the first neighbour to reach a cell keeps it. Shuffling
  // the order the neighbours are tried in therefore picks a different route
  // of the *same* minimal cost: the distances are untouched, so the carve is
  // still optimal and still costs the decoder exactly as much. Only `prev`
  // moves, which is what turns one URL into many different corridors.
  const order = [0, 1, 2, 3];

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

      if (random) shuffle(order, random);

      for (const direction of order) {
        const [dr, dc] = DIRECTIONS[direction];
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
  random?: () => number,
): BorderCarveResult | null {
  const endCell = idx(size, end.row, end.col);
  // Only the route varies with `random`; the distances it is chosen from do
  // not, so the start anchor this picks is the same corner cell either way.
  const { dist, prev } = searchFrom(size, modules, reserved, endCell, random);

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

/**
 * The nearest cell to a target that the search is allowed to stand on.
 *
 * A waypoint is picked geometrically, so it can easily land on a dark function
 * module — the corner of a finder, a dark cell of a timing line — which no
 * route may cross. Widening the search outward by Chebyshev radius finds the
 * closest legal stand-in, which is visually indistinguishable at board scale.
 */
function nearestLegal(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  row: number,
  col: number,
): number | null {
  for (let radius = 0; radius < size; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        // Only the ring at exactly this radius is new.
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;

        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(size, nr, nc)) continue;

        const cell = idx(size, nr, nc);
        if (stepCost(modules, reserved, cell) !== null) return cell;
      }
    }
  }
  return null;
}

/**
 * Corners the corridor is dragged through before it is allowed to finish.
 *
 * The start sits top-left and the exit bottom-right, so an unconstrained route
 * cuts straight down the diagonal. Sending it to the opposite corners first
 * bends that line into an L, then a Z, which lengthens the walk a long way
 * without growing the symbol.
 */
function chooseWaypoints(size: number, count: number): Point[] {
  const near = Math.round(size * 0.15);
  const far = Math.round(size * 0.85);

  // Bottom-left first, then top-right: taken in this order the legs alternate
  // direction instead of doubling back on themselves.
  const corners: Point[] = [
    { row: far, col: near },
    { row: near, col: far },
  ];
  return corners.slice(0, count);
}

/**
 * Carve a corridor that visits each waypoint on its way to the exit.
 *
 * Every leg is carved against the matrix the previous legs left behind, so a
 * later leg crosses an earlier one for free instead of paying to re-open it.
 * That sharing is what keeps a two-waypoint route affordable.
 */
export function carveThroughWaypoints(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  start: Point,
  end: Point,
  waypointCount: number,
  random?: () => number,
): CarveResult | null {
  const stops = [idx(size, start.row, start.col)];

  for (const point of chooseWaypoints(size, waypointCount)) {
    const cell = nearestLegal(size, modules, reserved, point.row, point.col);
    // A waypoint with no legal cell anywhere near it is not worth failing
    // over; the route simply skips that corner.
    if (cell !== null && cell !== stops[stops.length - 1]) stops.push(cell);
  }
  stops.push(idx(size, end.row, end.col));

  let current: Uint8Array = Uint8Array.from(modules);
  const carved = new Uint8Array(modules.length);
  let carvedCount = 0;

  for (let leg = 0; leg + 1 < stops.length; leg++) {
    const from = stops[leg];
    const to = stops[leg + 1];

    const { dist, prev } = searchFrom(size, current, reserved, from, random);
    if (dist[to] === -1) return null;

    const result = carveRoute(current, prev, to, from);
    current = result.modules;

    for (let cell = 0; cell < carved.length; cell++) {
      if (result.carved[cell] === 1 && carved[cell] === 0) {
        carved[cell] = 1;
        carvedCount++;
      }
    }
  }

  return { modules: current, carved, carvedCount };
}

/** Cells reachable on foot from a source, as a mask. */
function reachableFrom(size: number, modules: Uint8Array, source: number): Uint8Array {
  const seen = new Uint8Array(modules.length);
  if (modules[source] === 1) return seen;

  const queue = [source];
  seen[source] = 1;

  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const row = (cell / size) | 0;
    const col = cell % size;

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(size, nr, nc)) continue;

      const next = idx(size, nr, nc);
      if (seen[next] === 1 || modules[next] === 1) continue;

      seen[next] = 1;
      queue.push(next);
    }
  }

  return seen;
}

/** Whether the exit is still on foot from the start. */
function reaches(size: number, modules: Uint8Array, from: number, to: number): boolean {
  return reachableFrom(size, modules, from)[to] === 1;
}

export interface ModifyResult {
  /** The altered matrix. */
  readonly modules: Uint8Array;
  /** Mask of the cells this pass changed. */
  readonly changed: Uint8Array;
  readonly changedCount: number;
}

/**
 * Spend spare budget opening modules alongside the route.
 *
 * Candidates are dark modules that touch somewhere the player can already
 * stand, so every opening extends the playable space rather than hollowing out
 * a pocket nobody will ever see. The effect is branches, loops and more
 * winning routes — which is what makes a move budget forgiving.
 */
export function widenMaze(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  start: Point,
  quota: number,
  random: () => number,
): ModifyResult {
  const changed = new Uint8Array(modules.length);
  if (quota <= 0) return { modules, changed, changedCount: 0 };

  const reachable = reachableFrom(size, modules, idx(size, start.row, start.col));
  const candidates: number[] = [];

  for (let cell = 0; cell < modules.length; cell++) {
    if (modules[cell] === 0 || reserved[cell] === 1) continue;

    const row = (cell / size) | 0;
    const col = cell % size;

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(size, nr, nc)) continue;
      if (reachable[idx(size, nr, nc)] === 1) {
        candidates.push(cell);
        break;
      }
    }
  }

  shuffle(candidates, random);

  const widened = Uint8Array.from(modules);
  let changedCount = 0;

  for (const cell of candidates) {
    if (changedCount >= quota) break;
    widened[cell] = 0;
    changed[cell] = 1;
    changedCount++;
  }

  return { modules: widened, changed, changedCount };
}

/**
 * Spend spare budget filling light modules in.
 *
 * The error-correction budget is symmetric: a decoder cares how many modules
 * disagree with the encoded symbol, not which direction they moved. So the
 * same allowance that opens a wall can raise one, and raising walls is the
 * only way to *remove* alternatives from a board.
 *
 * Two rules keep it safe. Function modules are never touched — filling a light
 * cell of a timing pattern corrupts a structure the decoder navigates by,
 * which error correction does not cover. And every candidate is tried against
 * a connectivity check before it is kept, so the exit can never be walled off.
 */
export function plugMaze(
  size: number,
  modules: Uint8Array,
  reserved: Uint8Array,
  carved: Uint8Array,
  start: Point,
  end: Point,
  quota: number,
  random: () => number,
): ModifyResult {
  const changed = new Uint8Array(modules.length);
  if (quota <= 0) return { modules, changed, changedCount: 0 };

  const startCell = idx(size, start.row, start.col);
  const endCell = idx(size, end.row, end.col);
  const candidates: number[] = [];

  for (let cell = 0; cell < modules.length; cell++) {
    if (modules[cell] === 1 || reserved[cell] === 1) continue;
    if (cell === startCell || cell === endCell) continue;
    // Never undo the carver's work: that would spend the budget twice to end
    // up where the symbol already was.
    if (carved[cell] === 1) continue;
    candidates.push(cell);
  }

  shuffle(candidates, random);

  const plugged = Uint8Array.from(modules);
  let changedCount = 0;

  for (const cell of candidates) {
    if (changedCount >= quota) break;

    plugged[cell] = 1;
    if (reaches(size, plugged, startCell, endCell)) {
      changed[cell] = 1;
      changedCount++;
    } else {
      plugged[cell] = 0;
    }
  }

  return { modules: plugged, changed, changedCount };
}
