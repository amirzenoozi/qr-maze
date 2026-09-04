import { create } from 'zustand';
import { buildMaze, type MazeBuildAttempt } from '../lib/maze/build';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../lib/maze/difficulty';
import type { Maze, Point } from '../lib/maze/types';
import { idx } from '../lib/qr/types';
import { timeOfDayAt, type TimeOfDay } from '../lib/render/daylight';
import { DEFAULT_SKIN, PLAYER_SKINS, type PlayerSkinId } from '../lib/render/skins';

/** Camera presentation modes. */
export type CameraMode = 'gameplay' | 'scan';

/**
 * Which screen the app is on.
 *
 * `idle` and `error` both show the URL entry screen; `building` is the
 * loading screen; `ready` is the game itself.
 */
export type GameStatus = 'idle' | 'building' | 'ready' | 'error';

export interface GameState {
  readonly url: string;
  /** Tier the next build will use. Changing it does not rebuild on its own. */
  readonly difficulty: Difficulty;
  readonly status: GameStatus;
  readonly error: string | null;
  readonly maze: Maze | null;
  readonly attempts: readonly MazeBuildAttempt[];

  /** Epoch ms the current build started; also the progress bar's origin. */
  readonly buildStartedAt: number;
  /** How long the loading screen will be held open, in ms. */
  readonly buildDuration: number;

  readonly player: Point;
  readonly moves: number;
  readonly won: boolean;
  /** Set when the move budget runs out before the exit is reached. */
  readonly lost: boolean;
  /**
   * Retries left on the current board.
   *
   * Nothing in the maze can hurt the player, so a life is not damage: it is
   * the right to start this board over. The first attempt is free and every
   * restart after that spends one, whatever prompted it.
   */
  readonly lives: number;
  /**
   * Which of the equally cheap routes through the code this board takes.
   *
   * A clock reading, so nothing has to be stored to remember what has been
   * played. It survives as long as the player has hearts left on the board:
   * leaving for the entry screen and coming back gives you your maze, not a
   * new one. Only an exhausted board is re-rolled.
   */
  readonly variant: number;
  readonly cameraMode: CameraMode;

  /**
   * Which sky the 3D world is lit by.
   *
   * Starts from the visitor's local clock, then becomes a viewing preference:
   * nothing that resets a board touches it, so restarting, rebuilding or
   * returning to the entry screen all leave the player in the sky they chose.
   */
  readonly timeOfDay: TimeOfDay;

  /**
   * Which body the player is wearing.
   *
   * Cosmetic, and kept out of every reset for the same reason as the sky: it
   * is a preference, not part of a run.
   */
  readonly skin: PlayerSkinId;

  /**
   * Whether the corner badge is enlarged to its centred, easily scannable
   * size. It is the same element either way, so this is a presentation flag
   * rather than a separate dialog.
   */
  readonly scanCardOpen: boolean;

  setDifficulty: (difficulty: Difficulty) => void;
  /** Encode `url`, carve a maze from it and load it as the active level. */
  buildFromUrl: (url: string) => void;
  /** Attempt a one-cell orthogonal move; ignored when blocked or finished. */
  movePlayer: (deltaRow: number, deltaCol: number) => void;
  /**
   * Put the player back at the start of the same board.
   *
   * Costs a life, unless the board has just been won — a replay after a win
   * is free.
   */
  restart: () => void;
  /** Abandon the current maze and go back to the URL entry screen. */
  returnToStart: () => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  toggleTimeOfDay: () => void;
  setSkin: (skin: PlayerSkinId) => void;
  /** Step to the next body, wrapping. Bound to a key, so it has to wrap. */
  cycleSkin: () => void;
  openScanCard: () => void;
  closeScanCard: () => void;
  toggleScanCard: () => void;
}

const ORIGIN: Point = { row: 0, col: 0 };

/**
 * Retries granted per URL.
 *
 * Three hearts on top of the free first attempt, so a board is worth four
 * plays in total. Charging *every* restart — mid-run, after a win, after a
 * loss — is what makes the counter mean something: if only a loss cost a
 * life, pressing restart one move before the budget expired would dodge it.
 */
export const LIVES_PER_URL = 3;

/**
 * The loading screen is deliberately held open for 5-7 seconds.
 *
 * Carving is near-instant, so this delay is pure staging: it gives the
 * "generating your maze" beat somewhere to happen instead of flashing past.
 * Build *failures* skip the wait entirely — there is nothing to savour there.
 */
const BUILD_HOLD_MIN_MS = 5000;
const BUILD_HOLD_JITTER_MS = 2000;

/** Monotonic token so a superseded build can never overwrite a newer one. */
let buildSequence = 0;

export const useGameStore = create<GameState>((set, get) => ({
  url: 'https://www.linkedin.com/in/amirhosein-duzandeh-zenoozi/',
  difficulty: DEFAULT_DIFFICULTY,
  status: 'idle',
  error: null,
  maze: null,
  attempts: [],

  buildStartedAt: 0,
  buildDuration: 0,

  player: ORIGIN,
  moves: 0,
  won: false,
  lost: false,
  lives: LIVES_PER_URL,
  variant: Date.now(),
  cameraMode: 'gameplay',
  // Opens on whichever sky matches the visitor's own clock, then stays put.
  timeOfDay: timeOfDayAt(new Date()),
  skin: DEFAULT_SKIN,
  scanCardOpen: false,

  setDifficulty: (difficulty) => set({ difficulty }),

  buildFromUrl: (url) => {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      set({ status: 'error', error: 'Enter a URL to encode.' });
      return;
    }

    const token = ++buildSequence;
    const duration = BUILD_HOLD_MIN_MS + Math.random() * BUILD_HOLD_JITTER_MS;
    const startedAt = Date.now();

    // Re-roll the route only for a board the player has run out of hearts on.
    // Any other rebuild — a first visit, a change of tier, walking away from a
    // board you still have attempts on — keeps the maze you were given, so the
    // layout you learned is still there when you come back.
    const exhausted = get().lives <= 0;
    const variant = exhausted ? startedAt : get().variant;

    set({
      url: trimmed,
      status: 'building',
      error: null,
      maze: null,
      variant,
      buildStartedAt: startedAt,
      buildDuration: duration,
    });

    // Defer so the "building" state paints before the synchronous encode,
    // carve and decode round-trip block the main thread.
    setTimeout(() => {
      // A newer build started while this one was queued.
      if (token !== buildSequence) return;

      let result;
      try {
        result = buildMaze(trimmed, get().difficulty, variant);
      } catch (cause) {
        set({
          status: 'error',
          maze: null,
          error: cause instanceof Error ? cause.message : 'Failed to build maze.',
        });
        return;
      }

      if (!result.ok) {
        set({ status: 'error', error: result.reason, attempts: result.attempts, maze: null });
        return;
      }

      const maze = result.maze;
      const attempts = result.attempts;
      const remaining = Math.max(0, duration - (Date.now() - startedAt));

      setTimeout(() => {
        if (token !== buildSequence) return;
        set({
          status: 'ready',
          error: null,
          maze,
          attempts,
          player: maze.start,
          moves: 0,
          won: false,
          lost: false,
          lives: LIVES_PER_URL,
          cameraMode: 'gameplay',
          scanCardOpen: false,
        });
      }, remaining);
    }, 0);
  },

  movePlayer: (deltaRow, deltaCol) => {
    const { maze, player, won, lost, cameraMode } = get();
    if (!maze || won || lost) return;

    // The top-down view shows the whole board and a crosshair on the player,
    // which between them answer the question the maze is asking. Walking with
    // that open would not be playing it. Blocked here rather than in the input
    // hooks so keyboard and touch cannot diverge.
    if (cameraMode === 'scan') return;

    const row = player.row + deltaRow;
    const col = player.col + deltaCol;
    if (row < 0 || col < 0 || row >= maze.size || col >= maze.size) return;

    // Walkability is decided purely by the module colour: light modules are
    // corridors, dark modules are walls. A move into a wall is refused rather
    // than charged, so bumping around to feel out the maze is free.
    if (maze.modules[idx(maze.size, row, col)] === 1) return;

    const moves = get().moves + 1;
    const reachedExit = row === maze.end.row && col === maze.end.col;

    // The win is settled before the budget is. Spending the final move to
    // land on the exit is a win, not a loss on a technicality.
    // Winning deliberately leaves the camera alone. The floating badge is
    // already scannable at any moment, so yanking the view to top-down would
    // interrupt the win without offering anything the player cannot already do.
    set({
      player: { row, col },
      moves,
      won: reachedExit,
      lost: !reachedExit && moves >= maze.moveBudget,
    });
  },

  restart: () => {
    const { maze, lives, won } = get();
    if (!maze) return;

    // A replay after a win is free. Charging every restart closes the one
    // real loophole — restarting a move before the budget runs out — but a
    // solved board has nothing left to dodge, so taking a heart for a victory
    // lap only punishes finishing.
    const free = won;
    // Out of retries is the end of the board, so the only way on is a new URL.
    if (!free && lives <= 0) return;

    set({
      player: maze.start,
      moves: 0,
      won: false,
      lost: false,
      lives: free ? lives : lives - 1,
      cameraMode: 'gameplay',
      scanCardOpen: false,
    });
  },

  returnToStart: () => {
    // Bumping the token cancels any build still waiting out its hold.
    buildSequence++;
    set({
      status: 'idle',
      error: null,
      maze: null,
      attempts: [],
      player: ORIGIN,
      moves: 0,
      won: false,
      lost: false,
      // Hearts belong to a board, and this clears the board. Refilling here
      // would erase the one signal that says the last maze was used up, so
      // rebuilding the same link would hand back the board that just ended.
      cameraMode: 'gameplay',
      scanCardOpen: false,
    });
  },

  setCameraMode: (mode) => set({ cameraMode: mode }),

  toggleCameraMode: () =>
    set({ cameraMode: get().cameraMode === 'gameplay' ? 'scan' : 'gameplay' }),

  setTimeOfDay: (time) => set({ timeOfDay: time }),

  toggleTimeOfDay: () => set({ timeOfDay: get().timeOfDay === 'day' ? 'night' : 'day' }),

  setSkin: (skin) => set({ skin }),

  cycleSkin: () => {
    const next = (PLAYER_SKINS.indexOf(get().skin) + 1) % PLAYER_SKINS.length;
    set({ skin: PLAYER_SKINS[next] });
  },

  openScanCard: () => set({ scanCardOpen: true }),

  closeScanCard: () => set({ scanCardOpen: false }),

  toggleScanCard: () => set({ scanCardOpen: !get().scanCardOpen }),
}));
