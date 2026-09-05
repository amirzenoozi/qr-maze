import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordKey } from '../lib/persist';
import { DIRECTIONS } from '../lib/maze/types';
import { idx } from '../lib/qr/types';
import { timeOfDayAt } from '../lib/render/daylight';
import { PLAYER_SKINS } from '../lib/render/skins';
import { LIVES_PER_URL, useGameStore } from './gameStore';

/**
 * The sky the store booted with, captured before any test installs fake
 * timers, so asserting against it cannot drift with the suite's clock.
 */
const BOOT_SKY = timeOfDayAt(new Date());

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

  it('spends one on every restart of an unfinished or lost board', async () => {
    await build();

    for (let spent = 1; spent <= LIVES_PER_URL; spent++) {
      useGameStore.getState().restart();
      expect(useGameStore.getState().lives).toBe(LIVES_PER_URL - spent);
    }
  });

  it('replays a solved board for free', async () => {
    await build();
    useGameStore.setState({ won: true });

    useGameStore.getState().restart();

    expect(useGameStore.getState().lives).toBe(LIVES_PER_URL);
    expect(useGameStore.getState().won).toBe(false);
  });

  it('still replays a solved board with no hearts left', async () => {
    await build();
    useGameStore.setState({ won: true, lives: 0 });

    useGameStore.getState().restart();

    // Winning ends the board; there is nothing left to dodge by restarting.
    expect(useGameStore.getState().moves).toBe(0);
    expect(useGameStore.getState().lives).toBe(0);
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

describe('top view', () => {
  it('refuses to move while the board is flattened', async () => {
    await build();
    const step = firstLegalStep();
    useGameStore.getState().setCameraMode('scan');

    useGameStore.getState().movePlayer(...step);

    // The whole board and a crosshair on the player are on screen; walking
    // with that open would be reading the answer, not solving it.
    expect(useGameStore.getState().moves).toBe(0);
    expect(useGameStore.getState().player).toEqual(useGameStore.getState().maze?.start);
  });

  it('moves again once the view comes back', async () => {
    await build();
    const step = firstLegalStep();
    useGameStore.getState().setCameraMode('scan');
    useGameStore.getState().movePlayer(...step);

    useGameStore.getState().setCameraMode('gameplay');
    useGameStore.getState().movePlayer(...step);

    expect(useGameStore.getState().moves).toBe(1);
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

describe('time of day', () => {
  it('opens on the sky the visitor’s clock is showing', () => {
    expect(useGameStore.getState().timeOfDay).toBe(BOOT_SKY);
  });

  it('toggles both ways', () => {
    // Started from the clock, so the test cannot assume which sky that was.
    const start = useGameStore.getState().timeOfDay;

    useGameStore.getState().toggleTimeOfDay();
    expect(useGameStore.getState().timeOfDay).not.toBe(start);

    useGameStore.getState().toggleTimeOfDay();
    expect(useGameStore.getState().timeOfDay).toBe(start);
  });

  it('survives everything that resets a board', async () => {
    await build();
    useGameStore.getState().setTimeOfDay('night');

    // Each of these rewrites a batch of fields, and the realistic bug is one
    // of them quietly listing the sky among them.
    useGameStore.getState().restart();
    expect(useGameStore.getState().timeOfDay).toBe('night');

    await build('https://example.com');
    expect(useGameStore.getState().timeOfDay).toBe('night');

    useGameStore.getState().returnToStart();
    expect(useGameStore.getState().timeOfDay).toBe('night');
  });
});

describe('player skin', () => {
  it('cycles through every body and wraps', () => {
    expect(useGameStore.getState().skin).toBe(PLAYER_SKINS[0]);

    // It is bound to a key, so wrapping is the property that matters.
    for (const expected of [...PLAYER_SKINS.slice(1), PLAYER_SKINS[0]]) {
      useGameStore.getState().cycleSkin();
      expect(useGameStore.getState().skin).toBe(expected);
    }
  });

  it('survives everything that resets a board', async () => {
    await build();
    useGameStore.getState().setSkin('pixel');

    useGameStore.getState().restart();
    expect(useGameStore.getState().skin).toBe('pixel');

    await build('https://example.com');
    expect(useGameStore.getState().skin).toBe('pixel');

    useGameStore.getState().returnToStart();
    expect(useGameStore.getState().skin).toBe('pixel');
  });
});

describe('refused moves', () => {
  it('raises a fresh knock every time the board says no', async () => {
    await build();
    const { maze, player } = useGameStore.getState();
    if (!maze) throw new Error('no maze');

    // A direction that is either off the board or into a hedge.
    const blocked = DIRECTIONS.find(([deltaRow, deltaCol]) => {
      const row = player.row + deltaRow;
      const col = player.col + deltaCol;
      if (row < 0 || col < 0 || row >= maze.size || col >= maze.size) return true;
      return maze.modules[idx(maze.size, row, col)] === 1;
    });
    if (!blocked) throw new Error('start has no wall to bump');

    const before = useGameStore.getState().bump.nonce;
    useGameStore.getState().movePlayer(blocked[0], blocked[1]);

    const after = useGameStore.getState();
    expect(after.bump.nonce).toBe(before + 1);
    expect(after.bump.deltaRow).toBe(blocked[0]);
    expect(after.bump.deltaCol).toBe(blocked[1]);
    // Refused, so it stays free.
    expect(after.moves).toBe(0);
    expect(after.player).toEqual(player);

    // Twice against the same hedge has to read as two knocks, not one.
    useGameStore.getState().movePlayer(blocked[0], blocked[1]);
    expect(useGameStore.getState().bump.nonce).toBe(before + 2);
  });

  it('stays quiet when a move actually lands', async () => {
    await build();
    const before = useGameStore.getState().bump.nonce;

    const [deltaRow, deltaCol] = firstLegalStep();
    useGameStore.getState().movePlayer(deltaRow, deltaCol);

    expect(useGameStore.getState().bump.nonce).toBe(before);
    expect(useGameStore.getState().moves).toBe(1);
  });
});

describe('personal records', () => {
  /** Drop the player onto a light cell next to the exit. */
  function standByTheExit(): readonly [number, number] {
    const { maze } = useGameStore.getState();
    if (!maze) throw new Error('no maze');

    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const row = maze.end.row - deltaRow;
      const col = maze.end.col - deltaCol;
      if (row < 0 || col < 0 || row >= maze.size || col >= maze.size) continue;
      if (maze.modules[idx(maze.size, row, col)] === 1) continue;
      useGameStore.setState({ player: { row, col } });
      return [deltaRow, deltaCol];
    }
    throw new Error('exit has no open neighbour');
  }

  it('records the first solve and calls it an improvement', async () => {
    await build();
    const { maze } = useGameStore.getState();
    if (!maze) throw new Error('no maze');

    const [deltaRow, deltaCol] = standByTheExit();
    useGameStore.getState().movePlayer(deltaRow, deltaCol);

    const after = useGameStore.getState();
    expect(after.won).toBe(true);
    expect(after.improved).toBe(true);
    expect(after.records[recordKey(maze.url, maze.difficulty)]).toEqual({
      best: after.moves,
      solved: 1,
    });
  });

  it('counts a slower second solve without letting it take the best', async () => {
    await build();
    const { maze } = useGameStore.getState();
    if (!maze) throw new Error('no maze');

    let [deltaRow, deltaCol] = standByTheExit();
    useGameStore.getState().movePlayer(deltaRow, deltaCol);
    const best = useGameStore.getState().moves;

    // A replay after a win is free, so this costs no heart.
    useGameStore.getState().restart();
    [deltaRow, deltaCol] = standByTheExit();
    useGameStore.setState({ moves: best + 9 });
    useGameStore.getState().movePlayer(deltaRow, deltaCol);

    const after = useGameStore.getState();
    expect(after.won).toBe(true);
    expect(after.improved).toBe(false);
    expect(after.records[recordKey(maze.url, maze.difficulty)]).toEqual({ best, solved: 2 });
  });

  it('keeps a record per tier, since the tiers are different boards', async () => {
    await build();
    const first = useGameStore.getState().maze;
    if (!first) throw new Error('no maze');

    let [deltaRow, deltaCol] = standByTheExit();
    useGameStore.getState().movePlayer(deltaRow, deltaCol);

    useGameStore.getState().setDifficulty('insane');
    await build();
    [deltaRow, deltaCol] = standByTheExit();
    useGameStore.getState().movePlayer(deltaRow, deltaCol);

    const { records } = useGameStore.getState();
    expect(records[recordKey(first.url, 'normal')]).toBeDefined();
    expect(records[recordKey(first.url, 'insane')]).toBeDefined();
  });

  it('forgets nothing when a board is restarted or abandoned', async () => {
    await build();
    const { maze } = useGameStore.getState();
    if (!maze) throw new Error('no maze');

    const [deltaRow, deltaCol] = standByTheExit();
    useGameStore.getState().movePlayer(deltaRow, deltaCol);

    useGameStore.getState().restart();
    expect(useGameStore.getState().records[recordKey(maze.url, maze.difficulty)]).toBeDefined();
    expect(useGameStore.getState().improved).toBe(false);

    useGameStore.getState().returnToStart();
    expect(useGameStore.getState().records[recordKey(maze.url, maze.difficulty)]).toBeDefined();
  });
});
