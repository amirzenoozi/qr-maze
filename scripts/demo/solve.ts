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
    },
    null,
    2,
  )}\n`,
);
