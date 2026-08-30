import { getPositions as getAlignmentPositions } from 'qrcode/lib/core/alignment-pattern';
import { idx, inBounds } from './types';

/**
 * Build a mask of "function pattern" modules — the structural parts of a QR
 * symbol that carry no error-corrected payload and therefore may never be
 * altered by maze carving.
 *
 * Covered regions:
 *  - the three finder patterns and their separators (8x8 corner blocks)
 *  - both format-information strips
 *  - the horizontal and vertical timing patterns
 *  - every alignment pattern (5x5 blocks)
 *  - the two version-information blocks (version >= 7 only)
 *
 * The mask is deliberately a slight superset of the specification: whole
 * 8x8 corner blocks and whole format rows/columns are reserved rather than
 * the exact bit placements. Over-reserving costs a few playable cells but
 * removes any risk of corrupting symbol structure.
 *
 * @returns Row-major mask of length `size * size`; `1` = reserved.
 */
export function buildReservedMask(size: number, version: number): Uint8Array {
  const reserved = new Uint8Array(size * size);

  const mark = (row: number, col: number): void => {
    if (inBounds(size, row, col)) reserved[idx(size, row, col)] = 1;
  };

  const markRect = (row0: number, col0: number, rows: number, cols: number): void => {
    for (let r = row0; r < row0 + rows; r++) {
      for (let c = col0; c < col0 + cols; c++) mark(r, c);
    }
  };

  // Finder patterns (7x7) plus their 1-module separators => 8x8 corner blocks.
  markRect(0, 0, 8, 8); // top-left
  markRect(0, size - 8, 8, 8); // top-right
  markRect(size - 8, 0, 8, 8); // bottom-left

  // Format information: full row 8 / column 8 strips adjacent to each finder,
  // including the always-dark module at (size - 8, 8).
  for (let c = 0; c <= 8; c++) mark(8, c);
  for (let r = 0; r <= 8; r++) mark(r, 8);
  for (let c = size - 8; c < size; c++) mark(8, c);
  for (let r = size - 8; r < size; r++) mark(r, 8);

  // Timing patterns: the alternating row/column that spans the whole symbol.
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }

  // Alignment patterns (5x5, centred). `getPositions` already omits the
  // centres that would collide with a finder pattern.
  for (const [row, col] of getAlignmentPositions(version)) {
    markRect(row - 2, col - 2, 5, 5);
  }

  // Version information blocks, present from version 7 upwards.
  if (version >= 7) {
    markRect(0, size - 11, 6, 3);
    markRect(size - 11, 0, 3, 6);
  }

  return reserved;
}

/**
 * Count modules that are free to be carved (i.e. not function patterns).
 * Used to express carving cost as a fraction of the alterable payload area.
 */
export function countCarvableModules(reserved: Uint8Array): number {
  let free = 0;
  for (let i = 0; i < reserved.length; i++) if (reserved[i] === 0) free++;
  return free;
}
