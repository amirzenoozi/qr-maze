import { idx, inBounds } from '../qr/types';
import { DIRECTIONS, ROUTE_COUNT_CAP, type MazeAnalysis, type Point } from './types';

/**
 * Inspect a carved maze for playability.
 *
 * Runs a single breadth-first sweep from the start over walkable cells, which
 * yields three things at once: reachability of the exit, the length of a
 * shortest route, and — by pushing counts forward along the BFS layering — the
 * number of *distinct shortest routes*.
 *
 * Why shortest routes rather than all simple paths: the number of simple paths
 * through an open grid region is combinatorially explosive and not computable
 * in practice. Shortest-route counting is exact, linear, and answers the
 * question a player actually cares about — how many equally-quick ways there
 * are to win.
 *
 * Counts saturate at {@link ROUTE_COUNT_CAP} so every addition stays inside the
 * safe-integer range and remains exact below the cap.
 */
export function analyzeMaze(
  size: number,
  modules: Uint8Array,
  start: Point,
  end: Point,
): MazeAnalysis {
  const n = size * size;
  const startCell = idx(size, start.row, start.col);
  const endCell = idx(size, end.row, end.col);

  const unreachable: MazeAnalysis = {
    solvable: false,
    shortestLength: null,
    shortestRouteCount: 0,
    routeCountSaturated: false,
    reachableCells: 0,
  };

  if (modules[startCell] === 1 || modules[endCell] === 1) return unreachable;

  const dist = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const routes = new Float64Array(n);

  let head = 0;
  let tail = 0;
  dist[startCell] = 0;
  routes[startCell] = 1;
  order[tail++] = startCell;

  // Phase 1: BFS layering. `order` ends up sorted by non-decreasing distance.
  while (head < tail) {
    const cell = order[head++];
    const row = (cell / size) | 0;
    const col = cell % size;

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(size, nr, nc)) continue;

      const next = idx(size, nr, nc);
      if (modules[next] === 1 || dist[next] !== -1) continue;

      dist[next] = dist[cell] + 1;
      order[tail++] = next;
    }
  }

  const reachableCells = tail;
  if (dist[endCell] === -1) return { ...unreachable, reachableCells };

  // Phase 2: push route counts forward in BFS order. Every predecessor of a
  // cell sits one layer earlier, so its count is final before it is consumed.
  let saturated = false;
  for (let i = 0; i < tail; i++) {
    const cell = order[i];
    const count = routes[cell];
    if (count === 0) continue;

    const row = (cell / size) | 0;
    const col = cell % size;

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(size, nr, nc)) continue;

      const next = idx(size, nr, nc);
      if (dist[next] !== dist[cell] + 1) continue;

      const total = routes[next] + count;
      if (total >= ROUTE_COUNT_CAP) {
        routes[next] = ROUTE_COUNT_CAP;
        saturated = true;
      } else {
        routes[next] = total;
      }
    }
  }

  return {
    solvable: true,
    shortestLength: dist[endCell],
    shortestRouteCount: routes[endCell],
    routeCountSaturated: saturated && routes[endCell] >= ROUTE_COUNT_CAP,
    reachableCells,
  };
}
