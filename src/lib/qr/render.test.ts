import { describe, expect, it } from 'vitest';
import { buildMaze } from '../maze/build';
import { QR_STYLES, renderQr } from './render';
import { decodeRgba } from './verify';

const URLS = [
  'https://example.com',
  'https://github.com/pmndrs/react-three-fiber',
  'https://a.co/x',
  'https://shop.example.org/catalog?category=garden&sort=price&page=3',
] as const;

/** Render scale used by the on-screen badge. Tests must match it. */
const BADGE_SCALE = 10;

const STYLE_NAMES = Object.keys(QR_STYLES);

describe('styled QR rendering', () => {
  it('produces a correctly sized raster with a light quiet zone', () => {
    const result = buildMaze(URLS[0]);
    if (!result.ok) throw new Error(result.reason);

    const { maze } = result;
    const quietZone = 4;
    const raster = renderQr(maze.modules, maze.size, { scale: BADGE_SCALE, quietZone });

    const expected = (maze.size + quietZone * 2) * BADGE_SCALE;
    expect(raster.width).toBe(expected);
    expect(raster.height).toBe(expected);
    expect(raster.data.length).toBe(expected * expected * 4);

    // The whole first row sits inside the quiet zone, so it must be pure light.
    for (let px = 0; px < raster.width; px++) {
      expect(raster.data[px * 4]).toBe(255);
      expect(raster.data[px * 4 + 3]).toBe(255);
    }
  });

  it.each(STYLE_NAMES)('decodes back to the payload with the "%s" style', (name) => {
    for (const url of URLS) {
      const result = buildMaze(url);
      if (!result.ok) throw new Error(`${url}: ${result.reason}`);

      const { maze } = result;
      const raster = renderQr(maze.modules, maze.size, {
        ...QR_STYLES[name],
        scale: BADGE_SCALE,
      });

      expect(decodeRgba(raster.data, raster.width, raster.height)).toBe(url);
    }
  });

  it('still decodes at the smallest scale the badge can reach', () => {
    // The badge downscales to roughly 132 CSS px. Proving the raster survives a
    // low module scale guards against a style that only reads when huge.
    const result = buildMaze(URLS[3]);
    if (!result.ok) throw new Error(result.reason);

    const { maze } = result;
    const raster = renderQr(maze.modules, maze.size, { ...QR_STYLES.rounded, scale: 4 });
    expect(decodeRgba(raster.data, raster.width, raster.height)).toBe(URLS[3]);
  });

  it('actually changes the pixels between styles', () => {
    const result = buildMaze(URLS[0]);
    if (!result.ok) throw new Error(result.reason);

    const { maze } = result;
    const square = renderQr(maze.modules, maze.size, {
      ...QR_STYLES.square,
      scale: BADGE_SCALE,
    });
    const rounded = renderQr(maze.modules, maze.size, {
      ...QR_STYLES.rounded,
      scale: BADGE_SCALE,
    });

    let differences = 0;
    for (let offset = 0; offset < square.data.length; offset += 4) {
      if (square.data[offset] !== rounded.data[offset]) differences++;
    }

    // Corner rounding touches every dark module, so the delta is substantial.
    expect(differences).toBeGreaterThan(1000);
  });

  it('keeps the square style pixel-exact, with no intermediate greys', () => {
    const result = buildMaze(URLS[0]);
    if (!result.ok) throw new Error(result.reason);

    const { maze } = result;
    const raster = renderQr(maze.modules, maze.size, {
      ...QR_STYLES.square,
      scale: BADGE_SCALE,
    });

    for (let offset = 0; offset < raster.data.length; offset += 4) {
      expect([0, 255]).toContain(raster.data[offset]);
    }
  });
});
