import jsQR from 'jsqr';
import { idx } from './types';

/** Module pixel size and quiet-zone width used when rasterising for decode. */
const SCALE = 4;
const QUIET_ZONE = 4;

/**
 * Rasterise a module matrix into an RGBA buffer with a quiet zone.
 * Built by hand rather than via canvas so it runs identically in Node and the
 * browser, and so tests need no DOM.
 */
function rasterise(
  modules: Uint8Array,
  size: number,
): { data: Uint8ClampedArray; dimension: number } {
  const dimension = (size + QUIET_ZONE * 2) * SCALE;
  const data = new Uint8ClampedArray(dimension * dimension * 4).fill(255);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules[idx(size, row, col)] === 0) continue;

      const originY = (row + QUIET_ZONE) * SCALE;
      const originX = (col + QUIET_ZONE) * SCALE;

      for (let y = originY; y < originY + SCALE; y++) {
        for (let x = originX; x < originX + SCALE; x++) {
          const offset = (y * dimension + x) * 4;
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
        }
      }
    }
  }

  return { data, dimension };
}

/**
 * Decode an arbitrary RGBA raster, or `null` if unreadable.
 *
 * Exposed so that *styled* renders — rounded modules, shaped finder patterns —
 * can be put through a real decoder rather than assumed readable.
 */
export function decodeRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  return jsQR(data, width, height)?.data ?? null;
}

/** Decode a module matrix back to its payload, or `null` if unreadable. */
export function decodeMatrix(modules: Uint8Array, size: number): string | null {
  const { data, dimension } = rasterise(modules, size);
  return decodeRgba(data, dimension, dimension);
}

/**
 * Authoritative scannability check: does this (possibly carved) matrix still
 * decode to exactly the payload we encoded?
 *
 * This is stronger than comparing altered-module counts against a nominal
 * error-correction percentage, because it exercises a real decoder's
 * Reed-Solomon recovery rather than trusting a heuristic.
 */
export function verifyDecodes(modules: Uint8Array, size: number, expected: string): boolean {
  return decodeMatrix(modules, size) === expected;
}
