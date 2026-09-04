import { describe, expect, it } from 'vitest';
import { decodeMatrix } from '../qr/verify';
import { analyzeMaze } from './analyze';
import { buildMaze } from './build';
import { DIFFICULTIES, DIFFICULTY_CONFIG, moveBudget, type Difficulty } from './difficulty';
import type { Maze } from './types';

const URLS = [
  'https://a.co/x',
  'https://example.com',
  'https://github.com/amirzenoozi/qr-maze',
  'https://www.linkedin.com/in/amirhosein-duzandeh-zenoozi/',
];

/** Every tier for every URL, built once and shared across assertions. */
const BOARDS = new Map<string, Maze>(
  URLS.flatMap((url) =>
    DIFFICULTIES.map((difficulty): [string, Maze] => {
      const result = buildMaze(url, difficulty);
      if (!result.ok) throw new Error(`${difficulty} / ${url}: ${result.reason}`);
      return [`${difficulty}|${url}`, result.maze];
    }),
  ),
);

const board = (difficulty: Difficulty, url: string): Maze => {
  const maze = BOARDS.get(`${difficulty}|${url}`);
  if (!maze) throw new Error(`missing board for ${difficulty} / ${url}`);
  return maze;
};

const cases = URLS.flatMap((url) =>
  DIFFICULTIES.map((difficulty) => ({ url, difficulty })),
);

describe('difficulty', () => {
  // The whole point of the feature is that a harder board is still a QR code.
  // If a tier ever produces something a decoder cannot read, this fails.
  it.each(cases)('$difficulty still scans as the URL for $url', ({ url, difficulty }) => {
    const maze = board(difficulty, url);
    expect(decodeMatrix(maze.modules, maze.size)).toBe(url);
  });

  it.each(cases)('$difficulty stays playable for $url', ({ url, difficulty }) => {
    const maze = board(difficulty, url);

    expect(maze.analysis.solvable).toBe(true);
    expect(maze.modules[maze.start.row * maze.size + maze.start.col]).toBe(0);
    expect(maze.modules[maze.end.row * maze.size + maze.end.col]).toBe(0);
    expect(maze.start.row === 0 || maze.start.col === 0).toBe(true);
    expect(maze.end).toEqual({ row: maze.size - 1, col: maze.size - 1 });
  });

  it.each(cases)('$difficulty never touches a function pattern for $url', (
    { url, difficulty },
  ) => {
    const maze = board(difficulty, url);

    for (let cell = 0; cell < maze.modules.length; cell++) {
      if (maze.reserved[cell] === 1) {
        expect(maze.carved[cell]).toBe(0);
        expect(maze.plugged[cell]).toBe(0);
      }
    }
  });

  it.each(cases)('$difficulty allows at least a perfect run for $url', (
    { url, difficulty },
  ) => {
    const maze = board(difficulty, url);
    const shortest = maze.analysis.shortestLength;

    expect(shortest).not.toBeNull();
    // A budget below the shortest route would be unwinnable by construction.
    expect(maze.moveBudget).toBeGreaterThanOrEqual(shortest ?? 0);
    expect(maze.moveBudget).toBe(moveBudget(shortest ?? 0, difficulty));
  });

  it.each(cases)('$difficulty reports the edits it made for $url', ({ url, difficulty }) => {
    const maze = board(difficulty, url);

    const carved = maze.carved.reduce((total, flag) => total + flag, 0);
    const plugged = maze.plugged.reduce((total, flag) => total + flag, 0);
    expect(carved).toBe(maze.carvedCount);
    expect(plugged).toBe(maze.pluggedCount);

    // A cell cannot have been both opened and filled.
    for (let cell = 0; cell < maze.modules.length; cell++) {
      expect(maze.carved[cell] === 1 && maze.plugged[cell] === 1).toBe(false);
    }
  });

  it.each(URLS)('keeps the symbol the same size across tiers for %s', (url) => {
    const sizes = new Set(DIFFICULTIES.map((tier) => board(tier, url).size));
    const levels = new Set(DIFFICULTIES.map((tier) => board(tier, url).level));

    // Changing difficulty must not hand the player a differently-shaped code:
    // the level is chosen against a tier-independent probe precisely so this
    // holds.
    expect(sizes.size).toBe(1);
    expect(levels.size).toBe(1);
  });

  it.each(URLS)('opens up as the tier softens for %s', (url) => {
    const cells = (tier: Difficulty): number => board(tier, url).analysis.reachableCells;

    // Easy and Normal widen the same corridor from the same shuffled
    // candidate list, so Easy's openings are a strict superset of Normal's
    // and this cannot invert.
    expect(cells('easy')).toBeGreaterThanOrEqual(cells('normal'));

    // Insane routes through two far corners and plugs hardest, so it is never
    // more open than Easy. The links *between* those two ends are not
    // asserted: Hard and Insane bend the corridor through waypoints, so they
    // are measured on a different board than Easy and Normal, and a roomier
    // detour can leave Hard a cell or two ahead of Normal.
    expect(cells('insane')).toBeLessThanOrEqual(cells('easy'));
  });

  it.each(URLS)('sizes the move budget by the tier slack for %s', (url) => {
    // The guarantee is proportional, not absolute: each tier allows its own
    // slack over the shortest route *on its own board*. Comparing raw budgets
    // across tiers would compare different boards, and a widened Easy board
    // can genuinely offer a shorter best route than a plugged Hard one.
    let previous = Infinity;

    for (const tier of DIFFICULTIES) {
      const maze = board(tier, url);
      const shortest = maze.analysis.shortestLength ?? 0;
      const slack = (maze.moveBudget - shortest) / shortest;

      expect(maze.moveBudget).toBe(moveBudget(shortest, tier));
      expect(slack).toBeLessThan(previous);
      previous = slack;
    }
  });

  it.each(URLS)('re-routes without resizing the code for %s', (url) => {
    const boards = Array.from({ length: 8 }, (_unused, variant) => {
      const result = buildMaze(url, 'normal', variant);
      if (!result.ok) throw new Error(result.reason);
      return result.maze;
    });

    // Every variant is a different maze...
    const shapes = new Set(boards.map((maze) => maze.modules.join('')));
    expect(shapes.size).toBe(boards.length);

    // ...cut from the same symbol. The level is probed against one canonical
    // board, so exhausting your retries and re-entering the URL gives a new
    // route rather than a differently-sized code.
    expect(new Set(boards.map((maze) => `${maze.level}${maze.size}`)).size).toBe(1);

    for (const maze of boards) {
      expect(decodeMatrix(maze.modules, maze.size)).toBe(url);
      expect(maze.start.row + maze.start.col).toBe(7);
      expect(maze.analysis.solvable).toBe(true);
    }
  });

  it('rebuilds an identical board for the same URL and tier', () => {
    const [url] = URLS;
    const first = buildMaze(url, 'hard');
    const second = buildMaze(url, 'hard');

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    // Shared play links depend on this: the recipient must get the board the
    // sender solved, not a fresh roll of the same seed space.
    expect(Array.from(second.maze.modules)).toEqual(Array.from(first.maze.modules));
    expect(second.maze.moveBudget).toBe(first.maze.moveBudget);
  });

  it('agrees with a fresh analysis of the finished board', () => {
    for (const [key, maze] of BOARDS) {
      const fresh = analyzeMaze(maze.size, maze.modules, maze.start, maze.end);
      expect(fresh.shortestLength, key).toBe(maze.analysis.shortestLength);
      expect(fresh.reachableCells, key).toBe(maze.analysis.reachableCells);
    }
  });

  it('only lights the exit beacon below Insane', () => {
    expect(DIFFICULTY_CONFIG.insane.beacon).toBe(false);
    for (const tier of DIFFICULTIES.filter((name) => name !== 'insane')) {
      expect(DIFFICULTY_CONFIG[tier].beacon).toBe(true);
    }
  });

  it('never lets a tier overdraw the measured allowance', () => {
    // The decode limit is measured against a full spend, so a tier asking for
    // more than all of it would be spending money that was never counted.
    for (const tier of DIFFICULTIES) {
      const { widen, plug } = DIFFICULTY_CONFIG[tier];
      expect(widen + plug).toBeLessThanOrEqual(1);
    }
  });

  it('leaves Insane almost no slack and Easy plenty', () => {
    // Insane keeps a token margin rather than none: a single misread corner on
    // a beaconless board should not be unrecoverable, but it must stay small
    // enough that the route is still the point.
    expect(DIFFICULTY_CONFIG.insane.slack).toBeGreaterThan(0);
    expect(DIFFICULTY_CONFIG.insane.slack).toBeLessThanOrEqual(0.05);
    expect(DIFFICULTY_CONFIG.easy.slack).toBeGreaterThan(DIFFICULTY_CONFIG.insane.slack * 4);
    expect(moveBudget(40, 'insane')).toBe(42);
    expect(moveBudget(40, 'easy')).toBe(64);
  });
});
