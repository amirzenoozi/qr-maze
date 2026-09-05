import type { Point } from './types';

/** Edge length of one QR module in world units. */
export const CELL_SIZE = 1;

/** Height of a wall block in world units. */
export const WALL_HEIGHT = 1;

/**
 * Convert a matrix cell to world-space X/Z, centring the whole symbol on the
 * origin. Row increases towards +Z so the matrix reads top-to-bottom when the
 * camera looks down -Y with -Z pointing "up" on screen.
 */
export function cellToWorld(size: number, { row, col }: Point): [number, number] {
  const offset = ((size - 1) * CELL_SIZE) / 2;
  return [col * CELL_SIZE - offset, row * CELL_SIZE - offset];
}

/**
 * Margin of blank modules kept around the symbol. The QR specification
 * requires at least four; without it a scanner cannot lock onto the finder
 * patterns in scan mode.
 */
export const QUIET_ZONE = 4;

/** Full world-space width of the rendered symbol. */
export function boardExtent(size: number): number {
  return size * CELL_SIZE;
}

/** World-space width of the symbol including its quiet zone. */
export function floorExtent(size: number): number {
  return (size + QUIET_ZONE * 2) * CELL_SIZE;
}

/**
 * Extra blank ring drawn beyond the quiet zone in the top-down view.
 *
 * The position markers live out here rather than on the code. Anything drawn
 * over a module flips it — a coloured dot on a light module reads dark to a
 * binarising decoder — and anything inside the quiet zone eats the margin a
 * scanner needs to find the finder patterns. Outside both, a marker costs the
 * symbol nothing.
 */
export const MARKER_RING = 2;

/** World-space width of the top-down view, quiet zone plus marker ring. */
export function scanExtent(size: number): number {
  return (size + (QUIET_ZONE + MARKER_RING) * 2) * CELL_SIZE;
}

/**
 * Which side of the player the gameplay camera stands on, as a sign on Z.
 *
 * Rows run along +Z and the exit is the highest row, so `+1` puts the camera
 * between the player and the exit looking back over ground already crossed —
 * which is where it sat until the view was turned around. `-1` puts it behind
 * the player looking towards the exit, so the beacon marking it is finally in
 * shot.
 */
export const CAMERA_SIDE = -1;

/**
 * Grid step for one move in each on-screen direction.
 *
 * Turning the camera mirrors both axes at once: the direction that looked
 * like "up" now points the opposite way along Z, and screen-right swaps sides
 * on X with it. Deriving the mapping from `CAMERA_SIDE` rather than writing it
 * out twice is what stops the controls and the view from drifting apart — the
 * one bug this pairing is prone to.
 */
export const SCREEN_STEPS = {
  up: [-CAMERA_SIDE, 0],
  down: [CAMERA_SIDE, 0],
  left: [0, -CAMERA_SIDE],
  right: [0, CAMERA_SIDE],
} as const satisfies Record<string, readonly [number, number]>;
