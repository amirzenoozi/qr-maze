/**
 * Core QR domain types.
 *
 * A QR symbol is modelled as a flat, row-major matrix of "modules"
 * (the spec's word for a single square cell).
 */

/** QR error-correction levels, ordered weakest -> strongest. */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * Escalation order used when searching for the cheapest level that still
 * yields a scannable, solvable maze.
 */
export const EC_LEVELS: readonly ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

/**
 * Approximate share of the symbol that may be damaged and still decode.
 * These are the nominal recovery capacities from the QR specification and
 * are used only as a cheap pre-filter; the authoritative check is an actual
 * decode round-trip (see `verifyDecodes`).
 */
export const EC_DAMAGE_BUDGET: Record<ErrorCorrectionLevel, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.3,
};

export interface QrMatrix {
  /** Width and height of the symbol in modules (always `4 * version + 17`). */
  readonly size: number;
  /** QR version (1-40) chosen by the encoder for this payload. */
  readonly version: number;
  /** Error-correction level this symbol was encoded with. */
  readonly level: ErrorCorrectionLevel;
  /**
   * Row-major module data, length `size * size`.
   * `1` = dark module, `0` = light module.
   */
  readonly modules: Uint8Array;
}

/** Convert a `(row, col)` pair into a flat row-major index. */
export function idx(size: number, row: number, col: number): number {
  return row * size + col;
}

/** Whether `(row, col)` lies inside a `size x size` matrix. */
export function inBounds(size: number, row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < size && col < size;
}
