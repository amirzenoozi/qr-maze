import { describe, expect, it } from 'vitest';
import { buildMaze } from '../maze/build';
import { DIFFICULTIES } from '../maze/difficulty';
import type { Point } from '../maze/types';
import {
  CROSSHAIR_COLOUR,
  CROSSHAIR_OPACITY,
  CROSSHAIR_THICKNESS,
} from '../../components/ScanMarkers';
import { QR_STYLES, renderQr } from './render';
import { decodeRgba } from './verify';

/**
 * The top-down view draws a crosshair straight over the code, so the only
 * honest way to claim it still scans is to composite the same blend over a
 * rendered symbol and put it through a real decoder.
 *
 * This mirrors what the renderer does on screen: flat black modules on white,
 * the crosshair drawn on top at `CROSSHAIR_OPACITY`.
 */
const URLS = [
  'https://a.co/x',
  'https://example.com',
  'https://github.com/amirzenoozi/qr-maze',
  'https://www.linkedin.com/in/amirhosein-duzandeh-zenoozi/',
];

/** Pixels per module. Low enough to be a pessimistic reading of the screen. */
const SCALE = 8;
const QUIET_ZONE = 4;

function channels(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Alpha-blend the crosshair over the raster, exactly as the GPU would. */
function overlay(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  player: Point,
): void {
  const [lineR, lineG, lineB] = channels(CROSSHAIR_COLOUR);
  const half = (CROSSHAIR_THICKNESS * SCALE) / 2;

  const centreY = (QUIET_ZONE + player.row + 0.5) * SCALE;
  const centreX = (QUIET_ZONE + player.col + 0.5) * SCALE;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onRow = Math.abs(y + 0.5 - centreY) <= half;
      const onColumn = Math.abs(x + 0.5 - centreX) <= half;
      if (!onRow && !onColumn) continue;

      const at = (y * width + x) * 4;
      data[at] = data[at] * (1 - CROSSHAIR_OPACITY) + lineR * CROSSHAIR_OPACITY;
      data[at + 1] = data[at + 1] * (1 - CROSSHAIR_OPACITY) + lineG * CROSSHAIR_OPACITY;
      data[at + 2] = data[at + 2] * (1 - CROSSHAIR_OPACITY) + lineB * CROSSHAIR_OPACITY;
    }
  }
}

describe('top-down crosshair', () => {
  it.each(URLS)('leaves %s scannable from anywhere on the board', (url) => {
    for (const tier of DIFFICULTIES) {
      const result = buildMaze(url, tier);
      if (!result.ok) throw new Error(`${url} ${tier}: ${result.reason}`);
      const { maze } = result;

      // Corners, both endpoints and the middle: the crosshair crosses a
      // different set of modules from each, including straight through the
      // finder patterns and the timing lines.
      const spots: Point[] = [
        maze.start,
        maze.end,
        { row: 0, col: 0 },
        { row: 6, col: 6 },
        { row: (maze.size / 2) | 0, col: (maze.size / 2) | 0 },
        { row: maze.size - 1, col: 0 },
        { row: 0, col: maze.size - 1 },
      ];

      for (const spot of spots) {
        const raster = renderQr(maze.modules, maze.size, {
          ...QR_STYLES.square,
          scale: SCALE,
          quietZone: QUIET_ZONE,
        });

        overlay(raster.data, raster.width, raster.height, spot);

        expect(decodeRgba(raster.data, raster.width, raster.height)).toBe(url);
      }
    }
  });

  it('keeps both module colours clear of the midpoint', () => {
    const [lineR, lineG, lineB] = channels(CROSSHAIR_COLOUR);
    const blend = (value: number, line: number): number =>
      value * (1 - CROSSHAIR_OPACITY) + line * CROSSHAIR_OPACITY;

    // Rec. 709 luminance, which is what a binariser works from.
    const luma = (r: number, g: number, b: number): number =>
      0.2126 * r + 0.7152 * g + 0.0722 * b;

    const light = luma(blend(255, lineR), blend(255, lineG), blend(255, lineB));
    const dark = luma(blend(0, lineR), blend(0, lineG), blend(0, lineB));

    // A crossed light module must still read light and a dark one dark, with
    // room to spare. Tightening the opacity until this fails is the fastest
    // way to find the ceiling.
    expect(light).toBeGreaterThan(160);
    expect(dark).toBeLessThan(96);
    expect(light - dark).toBeGreaterThan(128);
  });
});
