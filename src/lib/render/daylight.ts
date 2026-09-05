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

/**
 * How one sky lights the world.
 *
 * The values live in `theme.ts`, one pair per world, because a lit grid under
 * a spring morning looks like a building site: the sky and the paint have to
 * be chosen together. This module owns the shape and the clock reading.
 *
 * Only the 3D world is affected. The panels and the HUD are already dark navy,
 * and the top-down view and the pinned scan card are unlit passes that ignore
 * lighting entirely, so nothing here can change whether the code scans.
 */
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
