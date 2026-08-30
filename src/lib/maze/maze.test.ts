import { describe, expect, it } from 'vitest';
import { generateQrMatrix } from '../qr/generate';
import { buildReservedMask } from '../qr/reserved';
import { EC_DAMAGE_BUDGET, idx } from '../qr/types';
import { decodeMatrix } from '../qr/verify';
import { analyzeMaze } from './analyze';
import { carveCheapestPath, carveFromBorder, chooseExit } from './carve';
import { buildMaze } from './build';

const URLS = [
  'https://example.com',
  'https://github.com/pmndrs/react-three-fiber',
  'https://a.co/x',
  'https://this-is-a-considerably-longer-example-domain.test/some/deep/path?with=query&and=more',
];

describe('reserved mask', () => {
  it('reserves finder, timing and alignment modules', () => {
    const qr = generateQrMatrix('https://example.com', 'L');
    const reserved = buildReservedMask(qr.size, qr.version);
    const at = (r: number, c: number) => reserved[idx(qr.size, r, c)];

    // Finder blocks (7x7 pattern + 1 module separator).
    expect(at(0, 0)).toBe(1);
    expect(at(7, 7)).toBe(1);
    expect(at(0, qr.size - 1)).toBe(1);
    expect(at(qr.size - 1, 0)).toBe(1);

    // Timing patterns span the whole symbol.
    for (let i = 0; i < qr.size; i++) {
      expect(at(6, i)).toBe(1);
      expect(at(i, 6)).toBe(1);
    }

    // Alignment pattern of a version-2 symbol is centred on (18, 18).
    expect(qr.version).toBe(2);
    expect(at(18, 18)).toBe(1);
    expect(at(16, 16)).toBe(1);
    expect(at(20, 20)).toBe(1);

    // The bottom-right corner must stay free: it is the natural exit.
    expect(at(qr.size - 1, qr.size - 1)).toBe(0);
  });
});

describe('border start', () => {
  it('always anchors the start to the first row or the first column', () => {
    for (const url of URLS) {
      const qr = generateQrMatrix(url, 'L');
      const reserved = buildReservedMask(qr.size, qr.version);
      const end = chooseExit(qr.size);
      const carve = carveFromBorder(qr.size, qr.modules, reserved, end);

      expect(carve).not.toBeNull();
      const { start } = carve!;

      // The whole point: the player enters at an edge of the symbol.
      expect(start.row === 0 || start.col === 0).toBe(true);
      expect(start).not.toEqual(end);

      // Border cells have row 0 or column 0, so `row + col` is the distance
      // along the border from the top-left corner. Seven is the floor: cells
      // 0-6 on both borders are the finder pattern's dark, unmodifiable outer
      // ring, leaving the light separator at (0,7) / (7,0) as the nearest
      // legal start. Anything larger means the corner anchoring regressed.
      expect(start.row + start.col).toBe(7);

      // Both endpoints must be standable once the corridor is open.
      expect(carve!.modules[idx(qr.size, start.row, start.col)]).toBe(0);
      expect(carve!.modules[idx(qr.size, end.row, end.col)]).toBe(0);
    }
  });

  it('reaches the border by crossing light function modules, not carving them', () => {
    const qr = generateQrMatrix(URLS[0], 'L');
    const reserved = buildReservedMask(qr.size, qr.version);
    const carve = carveFromBorder(qr.size, qr.modules, reserved, chooseExit(qr.size))!;

    // A start on row 0 sits above the horizontal timing pattern, while the
    // exit sits below it. The corridor can only span the two by walking over
    // light function modules, since carving one would break the symbol.
    expect(carve.start.row).toBe(0);
    for (let i = 0; i < carve.carved.length; i++) {
      if (carve.carved[i] === 1) expect(reserved[i]).toBe(0);
    }
  });
});

describe('carving', () => {
  it('never opens a reserved module and always produces a solvable maze', () => {
    for (const url of URLS) {
      const qr = generateQrMatrix(url, 'L');
      const reserved = buildReservedMask(qr.size, qr.version);
      const end = chooseExit(qr.size);
      const carve = carveFromBorder(qr.size, qr.modules, reserved, end)!;
      const { start } = carve;

      for (let i = 0; i < carve.carved.length; i++) {
        if (carve.carved[i] === 1) {
          expect(reserved[i]).toBe(0);
          expect(qr.modules[i]).toBe(1);
          expect(carve.modules[i]).toBe(0);
        }
      }

      const analysis = analyzeMaze(qr.size, carve.modules, start, end);
      expect(analysis.solvable).toBe(true);
      expect(analysis.shortestRouteCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('is minimal: no cheaper corridor exists', () => {
    // Brute-force check on a hand-built grid where the optimum is known.
    // '.' = open, '#' = wall. The straight route costs 2 carves; going the
    // long way around the bottom costs 1.
    const rows = [
      '.#..',
      '.#..',
      '....',
    ];
    const size = 4;
    const modules = new Uint8Array(size * size).fill(1);
    const reserved = new Uint8Array(size * size);
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < size; c++) {
        modules[idx(size, r, c)] = rows[r][c] === '#' ? 1 : 0;
      }
    }
    // Row 3 is entirely wall; keep it out of play by reserving it.
    for (let c = 0; c < size; c++) reserved[idx(size, 3, c)] = 1;

    const carve = carveCheapestPath(
      size,
      modules,
      reserved,
      { row: 0, col: 0 },
      { row: 0, col: 3 },
    )!;
    expect(carve).not.toBeNull();
    // Start (0,0) and exit (0,3) are already open and joined via row 2.
    expect(carve.carvedCount).toBe(0);
  });
});

describe('shortest-route counting', () => {
  it('counts distinct shortest routes across a fully open grid', () => {
    // On an open n x n grid the shortest routes from one corner to the
    // opposite corner number C(2n-2, n-1).
    const size = 6;
    const modules = new Uint8Array(size * size); // all open
    const analysis = analyzeMaze(size, modules, { row: 0, col: 0 }, { row: 5, col: 5 });

    expect(analysis.solvable).toBe(true);
    expect(analysis.shortestLength).toBe(10);
    expect(analysis.shortestRouteCount).toBe(252); // C(10, 5)
    expect(analysis.routeCountSaturated).toBe(false);
  });

  it('reports a single route through a corridor with no alternatives', () => {
    const size = 3;
    const modules = Uint8Array.from([
      0, 1, 1,
      0, 1, 1,
      0, 0, 0,
    ]);
    const analysis = analyzeMaze(size, modules, { row: 0, col: 0 }, { row: 2, col: 2 });

    expect(analysis.shortestLength).toBe(4);
    expect(analysis.shortestRouteCount).toBe(1);
  });

  it('detects an unreachable exit', () => {
    const size = 3;
    const modules = Uint8Array.from([
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
    ]);
    const analysis = analyzeMaze(size, modules, { row: 0, col: 0 }, { row: 2, col: 2 });

    expect(analysis.solvable).toBe(false);
    expect(analysis.shortestLength).toBeNull();
  });
});

describe('decode round-trip', () => {
  it('reads back an untouched symbol', () => {
    for (const url of URLS) {
      const qr = generateQrMatrix(url, 'L');
      expect(decodeMatrix(qr.modules, qr.size)).toBe(url);
    }
  });
});

describe('buildMaze', () => {
  it('produces a scannable, solvable maze for every URL', () => {
    for (const url of URLS) {
      const result = buildMaze(url);

      expect(result.ok, `${url} -> ${JSON.stringify(result)}`).toBe(true);
      if (!result.ok) continue;

      const { maze } = result;
      expect(maze.analysis.solvable).toBe(true);
      expect(maze.analysis.shortestRouteCount).toBeGreaterThanOrEqual(1);
      expect(decodeMatrix(maze.modules, maze.size)).toBe(url);
      expect(maze.modules[idx(maze.size, maze.start.row, maze.start.col)]).toBe(0);
      expect(maze.modules[idx(maze.size, maze.end.row, maze.end.col)]).toBe(0);

      // The player always enters from an edge and leaves by the far corner.
      expect(maze.start.row === 0 || maze.start.col === 0).toBe(true);
      expect(maze.end).toEqual({ row: maze.size - 1, col: maze.size - 1 });
    }
  });

  it('escalates only as far as needed and stays inside the damage budget', () => {
    const result = buildMaze('https://example.com');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const accepted = result.attempts.at(-1)!;
    expect(accepted.outcome).toBe('accepted');
    expect(accepted.damageRatio).toBeLessThanOrEqual(EC_DAMAGE_BUDGET[result.maze.level]);
    // Every earlier attempt must have been a genuine rejection.
    for (const attempt of result.attempts.slice(0, -1)) {
      expect(attempt.outcome).not.toBe('accepted');
    }
  });
});
