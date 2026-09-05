import type { SkyPalette, TimeOfDay } from './daylight';

/**
 * World themes.
 *
 * A theme is everything the 3D world looks like: the paint on the blocks and
 * the floor, the furniture standing on the board, and the two skies it can be
 * lit by. Nothing here can affect whether the code scans. The top-down view
 * swaps every material for flat black and white and unmounts the decoration,
 * and the pinned card is a 2D raster of the matrix, so neither one ever reads
 * a gameplay material.
 *
 * The record mirrors `daylight.ts` and `skins.ts`: an id, an ordered list, a
 * default, and one frozen entry per id.
 */

/** Which world the board is dressed as. */
export type ThemeId = 'park' | 'neon';

/** Selection order on the start screen, and the order `T` cycles through. */
export const THEMES: readonly ThemeId[] = ['park', 'neon'];

/** The world the game has always opened in. */
export const DEFAULT_THEME: ThemeId = 'park';

/**
 * How a surface is painted into its 16x16 canvas.
 *
 * The style picks the painter; the colours feed it. Splitting the two is what
 * lets a theme be a small record instead of a second copy of the texture file:
 * a neon wall is not hedge colours, it is a different painter entirely.
 */
export type SurfaceStyle =
  /** Flat noise from `base` and nothing else. */
  | 'speckle'
  /** Noise plus short vertical blades in `light` and `dark`. */
  | 'tufted'
  /** Noise plus vertical streaks, with an `edge` highlight along the top. */
  | 'streaked'
  /** Noise plus sparse single-pixel grains in `dark`. */
  | 'grains'
  /** Noise plus 2x2 clumps, with `specks` scattered over the top. */
  | 'clumped'
  /** Noise plus horizontal seams in `edge`, grain streaks, and one knot. */
  | 'planks'
  /** A plus-shaped flower on a transparent field, centred in `light`. */
  | 'petal'
  /** Solid `base[0]`, with an `edge` line along the top if one is given. */
  | 'flat'
  /** Solid `base[0]` under a lattice in `light`, brightened at the crossings. */
  | 'grid';

/**
 * One painted surface.
 *
 * Not every style reads every slot. `base` is the only one always used; the
 * rest are accents a painter may or may not reach for.
 */
export interface Surface {
  readonly style: SurfaceStyle;
  /** Sampled uniformly, so repeating an entry biases towards it. */
  readonly base: readonly string[];
  readonly light: string;
  readonly dark: string;
  /** The lit top edge: a hedge's sunlit lip, a plank seam, a neon strip. */
  readonly edge?: string;
  /** Sparse dots over the top: blossom in a canopy, a knot in timber. */
  readonly specks?: readonly string[];
}

/** One stacked tier of a finder-pattern landmark. */
export interface LandmarkTier {
  readonly width: number;
  readonly height: number;
  readonly y: number;
}

export interface ThemeDecor {
  /**
   * The thing standing on each of the three finder patterns.
   *
   * Tier widths must stay under the 7-module finder, or a landmark overhangs
   * a playable corridor. `theme.test.ts` holds that line.
   */
  readonly landmark: {
    readonly trunkWidth: number;
    readonly trunkHeight: number;
    readonly tiers: readonly LandmarkTier[];
    /** `tapered` narrows each tier towards its top, for pines and obelisks. */
    readonly shape: 'box' | 'tapered';
    /** Set to make the crown glow rather than merely catch the light. */
    readonly emissive?: string;
  };

  /** The barrier standing in the quiet zone, outside the board. */
  readonly border: {
    readonly postHeight: number;
    /** Heights to run rails at. Empty renders posts alone. */
    readonly railLevels: readonly number[];
    readonly capped: boolean;
  };

  /** What grows on top of the wall blocks. */
  readonly scatter: {
    /** Share of blocks carrying at least one. Zero renders none at all. */
    readonly density: number;
    readonly size: number;
    /** Per-instance tints multiplied over the texture. */
    readonly tints: readonly string[];
    readonly emissive: boolean;
  };

  /** The two cells that mean something. */
  readonly exit: {
    /** A chequered flag on the pole, or a bare pole. */
    readonly flag: boolean;
    readonly flagColours: readonly [string, string];
    readonly padColour: string;
    readonly padEmissive: string;
    readonly poleColour: string;
    readonly beamColour: string;
  };

  readonly start: {
    readonly padColour: string;
    readonly padEmissive: string;
  };
}

export interface Theme {
  readonly label: string;
  readonly blurb: string;
  readonly surfaces: {
    /** The lit top face of a wall block. */
    readonly wallTop: Surface;
    /** The four flanks of a wall block. */
    readonly wallSide: Surface;
    /** The plane the player walks on. */
    readonly floor: Surface;
    /** The landmark's stem. */
    readonly trunk: Surface;
    /** The landmark's crown. */
    readonly crown: Surface;
    /** The barrier's timber, or whatever stands in for it. */
    readonly border: Surface;
    /** One scattered thing, drawn on a transparent field. */
    readonly scatter: Surface;
  };
  readonly decor: ThemeDecor;
  /** Both skies, so a theme is coherent whichever one `N` lands on. */
  readonly sky: Record<TimeOfDay, SkyPalette>;
}

/**
 * The worlds.
 *
 * Park reproduces what the game has always rendered, value for value, so
 * introducing themes moves nothing for anyone who never opens the picker.
 */
export const THEME: Record<ThemeId, Theme> = {
  park: {
    label: 'Park',
    blurb: 'Hedges and gravel under a spring morning.',

    surfaces: {
      wallTop: {
        style: 'tufted',
        base: ['#7cc24a', '#7cc24a', '#7cc24a', '#8ed455', '#6cb03e', '#9ade63'],
        light: '#a6e874',
        dark: '#5da337',
      },
      wallSide: {
        style: 'streaked',
        base: ['#63ab3c', '#63ab3c', '#579934', '#6fb844'],
        light: '#79c04d',
        dark: '#549632',
        edge: '#8ed455',
      },
      floor: {
        style: 'grains',
        base: ['#ebe3c6', '#ebe3c6', '#ebe3c6', '#f2ecd6', '#ddd4b2', '#f7f2e2'],
        light: '#f7f2e2',
        dark: '#cdc39d',
      },
      trunk: {
        style: 'speckle',
        base: ['#8a6136', '#8a6136', '#74502c', '#9c7245'],
        light: '#9c7245',
        dark: '#6b4a2a',
      },
      crown: {
        style: 'clumped',
        base: ['#5fb63f', '#5fb63f', '#5fb63f', '#6fc94b', '#52a336', '#82dc5c'],
        light: '#8ae05f',
        dark: '#4a9531',
        // Ordered so a low random draws the pink and a high one the white,
        // matching the coin flip this replaced. Reversing the pair would
        // repaint every blossom onto a different pixel.
        specks: ['#ffd6ec', '#fdf3ff'],
      },
      border: {
        style: 'planks',
        base: ['#a56c39', '#a56c39', '#a56c39', '#b57c46', '#915c2e', '#8a5529'],
        light: '#c08c55',
        dark: '#8a5529',
        edge: '#71441f',
        specks: ['#6b3f1c'],
      },
      scatter: {
        style: 'petal',
        base: ['#ffffff', '#ffd9ec', '#ffe066', '#d9c2ff', '#ff9d9d'],
        light: '#ffd54a',
        dark: '#ffd54a',
      },
    },

    decor: {
      landmark: {
        trunkWidth: 0.9,
        trunkHeight: 2.6,
        tiers: [
          { width: 4.4, height: 1.1, y: 3.1 },
          { width: 3.2, height: 1.0, y: 4.0 },
          { width: 1.8, height: 0.9, y: 4.8 },
        ],
        shape: 'box',
      },
      border: {
        postHeight: 1.5,
        railLevels: [0.52, 1.08],
        capped: true,
      },
      scatter: {
        density: 0.34,
        size: 0.34,
        tints: ['#ffffff', '#ffd9ec', '#ffe066', '#d9c2ff', '#ff9d9d', '#bfe9ff'],
        emissive: false,
      },
      exit: {
        flag: true,
        flagColours: ['#ffffff', '#20242e'],
        padColour: '#ffc63f',
        padEmissive: '#ffab1f',
        poleColour: '#8a6136',
        beamColour: '#ffd76a',
      },
      start: {
        padColour: '#3fb6e8',
        padEmissive: '#2aa0d8',
      },
    },

    // The two skies the game shipped with, unchanged.
    sky: {
      // Spring morning: bright sky fill, warm low sun.
      day: {
        background: '#9fd8f5',
        ambient: { intensity: 1.15, color: '#dbeeff' },
        hemisphere: { intensity: 0.9, color: '#cfeaff', groundColor: '#7cc24a' },
        sun: { intensity: 1.5, color: '#fff4d8', position: [0.9, 0.7, 0.6] },
        glow: { intensity: 12, distance: 11, emissiveIntensity: 2.2 },
      },

      // Clear night. Two deliberate departures from realism:
      //
      // The moon sits high where the morning sun rakes low. Moonlight throws no
      // long shadows, and a high caster keeps the hedges in relief instead of
      // flattening the board into silhouettes you cannot read.
      //
      // Ambient is brighter than a night sky warrants because the scene renders
      // at 45% resolution and is upscaled. Genuine darkness bands badly at that
      // size, so the floor is lifted to where the gradients still hold together.
      //
      // The player's light finally does what it was built for: at noon a lantern
      // is invisible, so it was dimmed to a glow. Here it is the main light.
      night: {
        background: '#0b1128',
        ambient: { intensity: 0.22, color: '#5a72ad' },
        hemisphere: { intensity: 0.3, color: '#2b3f74', groundColor: '#1d3318' },
        sun: { intensity: 0.45, color: '#aec4ff', position: [0.5, 1.4, 0.4] },
        glow: { intensity: 30, distance: 16, emissiveIntensity: 3.2 },
      },
    },
  },

  neon: {
    label: 'Neon',
    blurb: 'A lit grid. The code stops pretending to be a garden.',

    surfaces: {
      // Dark slabs edged in light. The colour lives in the lines, not the
      // faces, which is also what survives a 16x16 canvas at 45% resolution.
      wallTop: {
        style: 'grid',
        base: ['#161a2e'],
        light: '#ff3ecf',
        dark: '#0d1022',
      },
      wallSide: {
        style: 'flat',
        base: ['#12162a'],
        light: '#3ad9ff',
        dark: '#0a0d1c',
        edge: '#3ad9ff',
      },
      // The floor is the one wide surface, so its lattice sets the whole look.
      floor: {
        style: 'grid',
        base: ['#0a0e1e'],
        light: '#2a5fd6',
        dark: '#060812',
      },
      trunk: {
        style: 'flat',
        base: ['#171c33'],
        light: '#3ad9ff',
        dark: '#0c1020',
        edge: '#3ad9ff',
      },
      crown: {
        style: 'flat',
        base: ['#3ad9ff'],
        light: '#c9f6ff',
        dark: '#1a8fb8',
        edge: '#c9f6ff',
      },
      border: {
        style: 'flat',
        base: ['#141830'],
        light: '#ff3ecf',
        dark: '#090c1a',
        edge: '#ff3ecf',
      },
      scatter: {
        style: 'petal',
        base: ['#3ad9ff', '#ff3ecf', '#c9f6ff'],
        light: '#ffffff',
        dark: '#ffffff',
      },
    },

    decor: {
      landmark: {
        // A single tall pylon rather than a spreading canopy: it reads as a
        // beacon from across the board, and nothing about a grid spreads.
        trunkWidth: 0.7,
        trunkHeight: 4.2,
        tiers: [
          { width: 1.4, height: 1.4, y: 5.6 },
          { width: 0.5, height: 1.2, y: 6.9 },
        ],
        shape: 'box',
        emissive: '#3ad9ff',
      },
      border: {
        // One low strip instead of two rails: a light line on the perimeter,
        // not a fence anybody could lean on.
        postHeight: 1.1,
        railLevels: [0.9],
        capped: false,
      },
      scatter: {
        // Sparser than the meadow. Glowing motes read as many more than they
        // are, and a dense field would wash out the wall edging.
        density: 0.14,
        size: 0.26,
        tints: ['#3ad9ff', '#ff3ecf', '#c9f6ff', '#8f6dff'],
        emissive: true,
      },
      exit: {
        // No flag. A chequered pennant is a race-day object and it drags the
        // whole corner back towards the park.
        flag: false,
        flagColours: ['#ff3ecf', '#0a0d1c'],
        padColour: '#ff3ecf',
        padEmissive: '#ff3ecf',
        poleColour: '#1b2340',
        beamColour: '#ff6ade',
      },
      start: {
        padColour: '#3ad9ff',
        padEmissive: '#3ad9ff',
      },
    },

    sky: {
      // "Day" here is dusk, not noon. A lit grid under a blue morning sky
      // looks like a building site; the theme only holds together after dark,
      // so its bright end is the last of the light rather than the middle of
      // the day. `N` still changes something worth changing.
      day: {
        background: '#241a4a',
        ambient: { intensity: 0.6, color: '#9d8ede' },
        hemisphere: { intensity: 0.45, color: '#c58cff', groundColor: '#1d2b6b' },
        sun: { intensity: 0.8, color: '#ffb3f0', position: [1.1, 0.35, 0.5] },
        glow: { intensity: 18, distance: 13, emissiveIntensity: 2.8 },
      },

      // Full dark. Ambient stays above what the scene warrants for the same
      // banding reason the park's night does, but lower: here the emissive
      // edging carries the shapes, so the fill has less work to do.
      night: {
        background: '#05060f',
        ambient: { intensity: 0.16, color: '#4a5cae' },
        hemisphere: { intensity: 0.22, color: '#2a1f5e', groundColor: '#0a1030' },
        sun: { intensity: 0.3, color: '#8fa8ff', position: [0.5, 1.4, 0.4] },
        glow: { intensity: 34, distance: 17, emissiveIntensity: 3.6 },
      },
    },
  },
};
