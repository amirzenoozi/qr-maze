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
