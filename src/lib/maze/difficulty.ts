/** How hard the generated maze should be to walk. */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';

/** Every tier, in ascending order of cruelty. */
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'insane'];

/** The tier a fresh game starts on. */
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export interface DifficultyConfig {
  /** Name shown on the tier button. */
  readonly label: string;
  /** One-line description of what the tier changes. */
  readonly blurb: string;
  /**
   * Spare moves allowed, as a fraction of the shortest route.
   *
   * Proportional rather than flat because a flat allowance means something
   * different on every board: `+15` is 38% slack on a 39-move maze and 20% on
   * a 75-move one, even though the longer maze has far more places to go
   * wrong. A fraction keeps the margin for error constant.
   */
  readonly slack: number;
  /**
   * Share of the granted structural allowance spent opening extra modules.
   * Widening adds branches and loops, which raises the number of winning
   * routes and makes the move budget easier to meet.
   */
  readonly widen: number;
  /**
   * Share of the granted allowance spent filling light modules in.
   *
   * Damage is symmetric — painting a light module dark costs the decoder
   * exactly what opening a dark one does — so this is the only lever that can
   * push the route count *down*. It prunes alternatives until the player has
   * to find close to the one right way through.
   */
  readonly plug: number;
  /**
   * How many corners the corridor is dragged through on its way to the exit.
   *
   * With none, the route cuts the diagonal. Each waypoint forces a long leg
   * across the board first, which lengthens the walk without touching the
   * board size.
   */
  readonly waypoints: number;
  /** Whether the exit beam is lit. */
  readonly beacon: boolean;
}

/**
 * Structural edits every tier asks for, as a fraction of the alterable area.
 *
 * Deliberately one number rather than one per tier. The requested amount is
 * what decides which error-correction level the symbol needs, so varying it
 * would resize the board when the player changed difficulty — and a QR code
 * that grows when you pick Easy is a confusing thing to hand someone. Every
 * tier gets the same allowance and differs in how it spends it.
 */
export const STRUCTURE_TARGET = 0.012;

/** Floor for small symbols, where a percentage of a tiny area rounds to noise. */
export const STRUCTURE_MINIMUM = 8;

/**
 * The edit mix the *level* is chosen against.
 *
 * Level selection has to be tier-independent, or picking Easy would hand the
 * player a differently-sized code from Hard for the same link. Every tier is
 * measured against one full-spend mix and then spends its own share of what
 * that level turned out to grant.
 */
export const CANONICAL_MIX = { widen: 1, plug: 0 } as const;

/**
 * Share of the *measured* decode limit we are willing to use.
 *
 * The limit is found by decoding a clean, synthetic, perfectly-aligned raster.
 * A phone camera works at an angle, in bad light, through motion blur, so
 * spending the last module of proven headroom would ship a code that only
 * scans in a screenshot. This keeps a third of it in reserve.
 */
export const STRUCTURE_SAFETY = 0.6;

/**
 * The ladder.
 *
 * `widen` and `plug` are shares of the structural allowance the symbol turned
 * out to have room for. They must sum to at most 1 — the allowance is measured
 * against a full spend, so a tier may leave error correction unused but must
 * never overdraw it. Spending less costs nothing and scans better.
 */
export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    blurb: 'Wide open, generous move budget.',
    slack: 0.6,
    widen: 1,
    plug: 0,
    waypoints: 0,
    beacon: true,
  },
  normal: {
    label: 'Normal',
    blurb: 'A few side routes and room to wander.',
    slack: 0.35,
    widen: 0.45,
    plug: 0,
    waypoints: 0,
    beacon: true,
  },
  hard: {
    label: 'Hard',
    blurb: 'The long way round, with dead ends.',
    slack: 0.15,
    widen: 0.15,
    plug: 0.6,
    waypoints: 1,
    beacon: true,
  },
  insane: {
    label: 'Insane',
    blurb: 'Barely any slack. No beacon to follow.',
    slack: 0.05,
    widen: 0,
    plug: 0.9,
    waypoints: 2,
    beacon: false,
  },
};

/**
 * Moves the player is allowed before the run is lost.
 *
 * Derived from the *analysed* shortest route rather than the carved corridor's
 * length. Those two differ whenever the symbol's own light modules offer a
 * shortcut past a waypoint, and only the analysed figure describes the board
 * the player actually walks.
 */
export function moveBudget(shortestLength: number, difficulty: Difficulty): number {
  const { slack } = DIFFICULTY_CONFIG[difficulty];
  return shortestLength + Math.ceil(shortestLength * slack);
}
