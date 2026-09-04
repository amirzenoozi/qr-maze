/** Which body the player is wearing. */
export type PlayerSkinId = 'firefly' | 'ember' | 'nova' | 'pixel';

/** Selection order, used by the picker and by the cycle key. */
export const PLAYER_SKINS: readonly PlayerSkinId[] = ['firefly', 'ember', 'nova', 'pixel'];

export const DEFAULT_SKIN: PlayerSkinId = 'firefly';

/**
 * The primitive the player is built from.
 *
 * All four are low-poly on purpose. The world is faceted everywhere else, so a
 * smooth or imported model would be the one high-detail object in it.
 */
export type SkinShape = 'sphere' | 'octahedron' | 'icosahedron' | 'cube';

/** How the body carries itself between cells. */
export type SkinMotion = 'bob' | 'spin' | 'tumble' | 'roll';

export interface PlayerSkin {
  readonly label: string;
  readonly blurb: string;
  readonly shape: SkinShape;
  readonly motion: SkinMotion;
  /** Body colour under direct light. */
  readonly color: string;
  /** Self-lit colour, which is what the body reads as in shadow. */
  readonly emissive: string;
  /** Tint of the travelling point light. */
  readonly light: string;
  /**
   * Multipliers on the sky's lantern rather than absolute values.
   *
   * The sky already decides the light's role — a dim glow at noon, the main
   * light source at night. A skin should shift that, not replace it, or
   * choosing a body would quietly break how the night is lit.
   */
  readonly glow: { readonly intensity: number; readonly distance: number };
}

/**
 * The four bodies.
 *
 * The player is hidden outside gameplay (`visible` is false in the top-down
 * view, and three.js skips invisible lights with it), so nothing here can
 * affect whether the code scans.
 *
 * The palettes are picked against the world rather than against each other.
 * The board is green hedges and cream gravel under a blue or navy sky, so
 * orange reads as the complement of the sky and magenta as the complement of
 * the hedges. Green would have vanished into the walls.
 */
export const SKIN: Record<PlayerSkinId, PlayerSkin> = {
  // The original. Left exactly as it was so the default render is unchanged.
  firefly: {
    label: 'Firefly',
    blurb: 'A cool blue glow that bobs as it travels.',
    shape: 'sphere',
    motion: 'bob',
    color: '#7de2ff',
    emissive: '#37c6ff',
    light: '#8fe3ff',
    glow: { intensity: 1, distance: 1 },
  },

  // A burning coal: the light pools hot and close, so the hedges either side
  // are lit hard and the corridor ahead falls away faster.
  ember: {
    label: 'Ember',
    blurb: 'A hot coal. Lights the walls beside you, not the way ahead.',
    shape: 'octahedron',
    motion: 'spin',
    color: '#ffc48a',
    emissive: '#ff6a1a',
    light: '#ffb066',
    glow: { intensity: 1.15, distance: 0.85 },
  },

  // The opposite trade: a cold pinpoint that reaches further but lights
  // everything less, which is the closest thing here to an easier night.
  nova: {
    label: 'Nova',
    blurb: 'A cold star. Dimmer, but it reaches further down the corridor.',
    shape: 'icosahedron',
    motion: 'tumble',
    color: '#ffa8ee',
    emissive: '#ff3ecf',
    light: '#ff8fe8',
    glow: { intensity: 0.9, distance: 1.2 },
  },

  // Native to this world: the hedges, the blossoms, the fence and the confetti
  // are all boxes already. Rolling is what gives movement any weight — every
  // other body slides.
  pixel: {
    label: 'Pixel',
    blurb: 'A block that rolls, cut from the same stuff as the walls.',
    shape: 'cube',
    motion: 'roll',
    color: '#fff0c2',
    emissive: '#ffc94a',
    light: '#ffe9b0',
    glow: { intensity: 1, distance: 1 },
  },
};
