/**
 * Solves a maze offline so the demo recorder can drive the player with a
 * fixed key sequence. `buildMaze` is deterministic for a given URL, so the
 * route computed here is exactly the route the browser will need.
 *
 * Usage: npx vite-node scripts/demo/solve.ts "<url>" > moves.json
 */
import { buildMaze } from '../../src/lib/maze/build';
import { DIRECTIONS, type Point } from '../../src/lib/maze/types';
import { idx, inBounds } from '../../src/lib/qr/types';

/** A single arrow-key press, in the order the recorder should send them. */
type Key = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const KEY_FOR_DELTA: Record<string, Key> = {
  '-1,0': 'ArrowUp',
  '1,0': 'ArrowDown',
  '0,-1': 'ArrowLeft',
  '0,1': 'ArrowRight',
};

/** Breadth-first search over light modules, returning one shortest route. */
function shortestRoute(size: number, modules: Uint8Array, start: Point, end: Point): Point[] {
  const previous = new Int32Array(size * size).fill(-1);
  const source = idx(size, start.row, start.col);
  const target = idx(size, end.row, end.col);
  previous[source] = source;

  const queue: number[] = [source];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (cell === target) break;
    const row = Math.floor(cell / size);
    const col = cell % size;

    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const nextRow = row + deltaRow;
      const nextCol = col + deltaCol;
      if (!inBounds(size, nextRow, nextCol)) continue;
      const next = idx(size, nextRow, nextCol);
      if (previous[next] !== -1 || modules[next] === 1) continue;
      previous[next] = cell;
      queue.push(next);
    }
  }

  if (previous[target] === -1) return [];

  const route: Point[] = [];
  for (let cell = target; cell !== source; cell = previous[cell]) {
    route.push({ row: Math.floor(cell / size), col: cell % size });
  }
  route.push(start);
  return route.reverse();
}

const url = process.argv[2] ?? 'https://www.linkedin.com/in/amirhosein-duzandeh-zenoozi/';
const result = buildMaze(url);

if (!result.ok) {
  throw new Error(`could not build a maze for ${url}: ${result.reason}`);
}

const { maze } = result;
const route = shortestRoute(maze.size, maze.modules, maze.start, maze.end);
if (route.length === 0) throw new Error('the maze reported solvable but no route was found');

const keys: Key[] = [];
for (let step = 1; step < route.length; step += 1) {
  const deltaRow = route[step].row - route[step - 1].row;
  const deltaCol = route[step].col - route[step - 1].col;
  keys.push(KEY_FOR_DELTA[`${deltaRow},${deltaCol}`]);
}

// Keys that run straight into a hedge from each cell along the route. The
// recorder presses one of these now and then so the video shows the player
// bumping off a wall: the store refuses the move, so the sphere stays put and
// the collision reads on screen without knocking the run off its route.
const blocked: Key[][] = route.map((cell) => {
  const wrong: Key[] = [];
  for (const [deltaRow, deltaCol] of DIRECTIONS) {
    const nextRow = cell.row + deltaRow;
    const nextCol = cell.col + deltaCol;
    const key = KEY_FOR_DELTA[`${deltaRow},${deltaCol}`];
    if (!inBounds(maze.size, nextRow, nextCol)) {
      wrong.push(key);
      continue;
    }
    if (maze.modules[idx(maze.size, nextRow, nextCol)] === 1) wrong.push(key);
  }
  return wrong;
});

const REVERSE: Record<Key, Key> = {
  ArrowUp: 'ArrowDown',
  ArrowDown: 'ArrowUp',
  ArrowLeft: 'ArrowRight',
  ArrowRight: 'ArrowLeft',
};

const onRoute = new Set(route.map((cell) => idx(maze.size, cell.row, cell.col)));

/**
 * Walks as far as it can down a side branch without rejoining the winning
 * route, up to `limit` steps. Greedy rather than exhaustive: the demo only
 * needs a believable wrong turn, not the longest one.
 */
function strayFrom(cell: Point, first: Key, limit: number): Key[] {
  const taken: Key[] = [];
  const seen = new Set([idx(maze.size, cell.row, cell.col)]);
  let here = cell;
  let next: Key | null = first;

  while (next && taken.length < limit) {
    const [deltaRow, deltaCol] = DIRECTIONS.find((d) => KEY_FOR_DELTA[`${d[0]},${d[1]}`] === next)!;
    here = { row: here.row + deltaRow, col: here.col + deltaCol };
    seen.add(idx(maze.size, here.row, here.col));
    taken.push(next);

    next = null;
    for (const [nextRow, nextCol] of DIRECTIONS) {
      const row = here.row + nextRow;
      const col = here.col + nextCol;
      if (!inBounds(maze.size, row, col)) continue;
      const at = idx(maze.size, row, col);
      if (maze.modules[at] === 1 || seen.has(at) || onRoute.has(at)) continue;
      next = KEY_FOR_DELTA[`${nextRow},${nextCol}`];
      break;
    }
  }

  return taken;
}

// A wrong turn the player can walk into and back out of. Unlike a wall bump,
// which leaves the sphere motionless, a detour is visibly a mistake — and it
// shows the board has branches rather than one scripted corridor.
const detours: (Key[] | null)[] = route.map((cell, step) => {
  const forward = keys[step] ?? null;
  const back = step > 0 ? REVERSE[keys[step - 1]] : null;

  for (const [deltaRow, deltaCol] of DIRECTIONS) {
    const key = KEY_FOR_DELTA[`${deltaRow},${deltaCol}`];
    if (key === forward || key === back) continue;
    const row = cell.row + deltaRow;
    const col = cell.col + deltaCol;
    if (!inBounds(maze.size, row, col)) continue;
    if (maze.modules[idx(maze.size, row, col)] === 1) continue;
    if (onRoute.has(idx(maze.size, row, col))) continue;

    const stray = strayFrom(cell, key, 3);
    if (stray.length >= 2) return [...stray, ...[...stray].reverse().map((k) => REVERSE[k])];
  }

  return null;
});

process.stdout.write(
  `${JSON.stringify(
    {
      url,
      level: maze.level,
      version: maze.version,
      size: maze.size,
      start: maze.start,
      end: maze.end,
      moves: maze.analysis.shortestLength,
      routes: maze.analysis.shortestRouteCount,
      keys,
      blocked,
      detours,
    },
    null,
    2,
  )}\n`,
);
