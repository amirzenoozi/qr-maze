import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIRECTIONS } from '../lib/maze/types';
import { idx } from '../lib/qr/types';
import { LIVES_PER_URL, useGameStore } from './gameStore';

/** Smallest symbol of the usual test set, so each build stays quick. */
const URL = 'https://a.co/x';

const INITIAL = useGameStore.getState();

/**
 * Run a build to completion.
 *
 * The loading screen is deliberately held open for 5-7 seconds, so the only
 * way to observe a finished build is to fast-forward past the hold.
 */
async function build(url = URL): Promise<void> {
  useGameStore.getState().buildFromUrl(url);
  await vi.advanceTimersByTimeAsync(10_000);
}

/** Any legal one-cell step from the player's current position. */
function firstLegalStep(): readonly [number, number] {
  const { maze, player } = useGameStore.getState();
  if (!maze) throw new Error('no maze');

  for (const [deltaRow, deltaCol] of DIRECTIONS) {
    const row = player.row + deltaRow;
    const col = player.col + deltaCol;
    if (row < 0 || col < 0 || row >= maze.size || col >= maze.size) continue;
    if (maze.modules[idx(maze.size, row, col)] === 1) continue;
    return [deltaRow, deltaCol];
  }

  throw new Error('start is walled in');
}

beforeEach(() => {
  vi.useFakeTimers();
  useGameStore.setState(INITIAL, true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('lives', () => {
  it('starts a fresh board with a full set', async () => {
    await build();

    expect(useGameStore.getState().status).toBe('ready');
    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL);
  });

  it('spends one on every restart, whatever prompted it', async () => {
    await build();

    for (let spent = 1; spent <= LIVES_PER_URL; spent++) {
      useGameStore.getState().restart();
      expect(useGameStore.getState().lives).toBe(LIVES_PER_URL - spent);
    }
  });

  it('puts the player back at the start when it spends one', async () => {
    await build();
    const { maze } = useGameStore.getState();

    useGameStore.getState().movePlayer(...firstLegalStep());
    expect(useGameStore.getState().moves).toBe(1);

    useGameStore.getState().restart();

    expect(useGameStore.getState().player).toEqual(maze?.start);
    expect(useGameStore.getState().moves).toBe(0);
    expect(useGameStore.getState().won).toBe(false);
    expect(useGameStore.getState().lost).toBe(false);
  });

  it('refuses to restart once they are gone', async () => {
    await build();
    useGameStore.setState({ lives: 0, moves: 12 });

    useGameStore.getState().restart();

    // Nothing moved: an exhausted board is over, and the way on is a new URL.
    expect(useGameStore.getState().lives).toBe(0);
    expect(useGameStore.getState().moves).toBe(12);
  });

  it('is not charged for running out of moves, only for the retry', async () => {
    await build();
    const budget = useGameStore.getState().maze?.moveBudget ?? 0;
    useGameStore.setState({ moves: budget - 1 });

    useGameStore.getState().movePlayer(...firstLegalStep());

    expect(useGameStore.getState().lost).toBe(true);
    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL);
  });

  it('refills on a new URL', async () => {
    await build();
    useGameStore.getState().restart();
    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL - 1);

    await build('https://example.com');

    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL);
  });

  it('survives a trip to the entry screen, so the board comes back too', async () => {
    await build();
    const first = useGameStore.getState().maze?.modules.join('');
    useGameStore.getState().restart();

    useGameStore.getState().returnToStart();
    expect(useGameStore.getState().status).toBe('idle');
    // Hearts belong to a board, and this cleared the board. Refilling here
    // would lose the one signal that says the maze has been used up.
    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL - 1);

    await build();

    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL);
    expect(useGameStore.getState().maze?.modules.join('')).toBe(first);
  });
});

describe('board variant', () => {
  it('keeps the same maze while the player still has hearts', async () => {
    await build();
    const first = useGameStore.getState().maze?.modules.join('');

    useGameStore.getState().restart();
    useGameStore.getState().returnToStart();
    await build();

    expect(useGameStore.getState().maze?.modules.join('')).toBe(first);
  });

  it('re-routes once the hearts are gone', async () => {
    await build();
    const first = useGameStore.getState().maze;

    for (let i = 0; i < LIVES_PER_URL; i++) useGameStore.getState().restart();
    expect(useGameStore.getState().lives).toBe(0);

    // The clock is the variant, so it has to actually move.
    await vi.advanceTimersByTimeAsync(1000);
    await build();
    const second = useGameStore.getState().maze;

    expect(second?.modules.join('')).not.toBe(first?.modules.join(''));
    // A new route through the same code, not a differently sized one.
    expect(second?.size).toBe(first?.size);
    expect(second?.level).toBe(first?.level);
    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL);
  });
});
