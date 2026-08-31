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
    const reachable = DIFFICULTIES.map((tier) => board(tier, url).analysis.reachableCells);

    // Easy is the most open and Insane the tightest. Adjacent tiers can tie —
    // plugging is rejected wherever it would disconnect the exit — but the
    // ordering must never invert.
    for (let i = 1; i < reachable.length; i++) {
      expect(reachable[i]).toBeLessThanOrEqual(reachable[i - 1]);
    }
  });

  it.each(URLS)('loosens the move budget as the tier softens for %s', (url) => {
    const budgets = DIFFICULTIES.map((tier) => board(tier, url).moveBudget);

    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeLessThan(budgets[i - 1]);
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

  it('demands a perfect route on Insane and nothing less than one on Easy', () => {
    expect(DIFFICULTY_CONFIG.insane.slack).toBe(0);
    expect(DIFFICULTY_CONFIG.easy.slack).toBeGreaterThan(0);
    expect(moveBudget(40, 'insane')).toBe(40);
    expect(moveBudget(40, 'easy')).toBe(64);
  });
});
