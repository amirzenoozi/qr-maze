/** Which sky the 3D world is lit by. */
export type TimeOfDay = 'day' | 'night';

/** Local hours the day sky covers, from the first to the last. */
const DAY_STARTS_AT = 7;
const NIGHT_STARTS_AT = 19;

/**
 * The sky to open on, read off the visitor's own clock.
 *
 * Only ever used for the starting value. Once the sky has been chosen it stays
 * chosen — recomputing it as the evening arrives would overrule someone who had
 * deliberately picked the other one, and a board relighting itself mid-run is a
 * worse surprise than opening on the wrong sky.
 */
export function timeOfDayAt(date: Date): TimeOfDay {
  const hour = date.getHours();
  return hour >= DAY_STARTS_AT && hour < NIGHT_STARTS_AT ? 'day' : 'night';
}

export interface SkyPalette {
  /** Canvas clear colour, standing in for the sky. */
  readonly background: string;
  readonly ambient: { readonly intensity: number; readonly color: string };
  readonly hemisphere: {
    readonly intensity: number;
    readonly color: string;
    readonly groundColor: string;
  };
  /**
   * The one shadow-casting light. Its position is expressed as multipliers of
   * the board's reach, so it scales with the symbol rather than the URL.
   */
  readonly sun: {
    readonly intensity: number;
    readonly color: string;
    readonly position: readonly [number, number, number];
  };
  /** The player's own lantern, which changes role between the two skies. */
  readonly glow: {
    readonly intensity: number;
    readonly distance: number;
    readonly emissiveIntensity: number;
  };
}

/**
 * The two skies.
 *
 * Only the 3D world changes. The panels and the HUD are already dark navy, and
 * the top-down view and the pinned scan card are unlit passes that ignore
 * lighting entirely, so nothing here can affect whether the code scans.
 */
export const SKY: Record<TimeOfDay, SkyPalette> = {
  // Spring morning: bright sky fill, warm low sun. These are the values the
  // scene has always used, kept exactly so the default render is unchanged.
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
  // Ambient is brighter than a night sky warrants because the scene renders at
  // 45% resolution and is upscaled. Genuine darkness bands badly at that size,
  // so the floor is lifted to where the gradients still hold together.
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
};
