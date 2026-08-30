/**
 * Minimal typings for the internal `qrcode` modules we reach into.
 * The package ships these as untyped CommonJS.
 */
declare module 'qrcode/lib/core/alignment-pattern' {
  /**
   * Centre coordinates of every alignment pattern for a given QR version,
   * already excluding the positions that overlap a finder pattern.
   * Each entry is a `[row, col]` pair.
   */
  export function getPositions(version: number): Array<[number, number]>;

  /** Raw row/column coordinate table for a given version. */
  export function getRowColCoords(version: number): number[];
}
