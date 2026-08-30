import { idx } from './types';

/** An 8-bit RGB triple. */
export type Rgb = readonly [number, number, number];

/** Shape used for ordinary data modules. */
export type ModuleStyle = 'square' | 'rounded';

/** Shape used for the three finder patterns ("eyes"). */
export type EyeStyle = 'square' | 'rounded';

export interface QrStyle {
  /** Shape of an ordinary data module. */
  readonly moduleStyle: ModuleStyle;
  /** Shape of the finder patterns. */
  readonly eyeStyle: EyeStyle;
  /** Data-module corner radius, as a fraction of one module (0-0.5). */
  readonly moduleRadius: number;
  /** Finder corner radius, as a fraction of one module. */
  readonly eyeRadius: number;
  readonly dark: Rgb;
  readonly light: Rgb;
}

export interface QrRenderOptions extends Partial<QrStyle> {
  /** Output pixels per module. */
  readonly scale?: number;
  /** Light margin in modules. The QR specification requires at least four. */
  readonly quietZone?: number;
}

export interface QrRaster {
  /**
   * RGBA, row-major, `width * height * 4` bytes.
   *
   * Pinned to `ArrayBuffer` rather than `ArrayBufferLike` so the buffer can be
   * handed straight to the `ImageData` constructor, which rejects a possibly
   * shared backing store.
   */
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
}

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/**
 * Named presets. Every one of these is covered by a real `jsQR` decode test,
 * so a style that stops scanning fails the build rather than shipping.
 */
export const QR_STYLES: Record<string, QrStyle> = {
  square: {
    moduleStyle: 'square',
    eyeStyle: 'square',
    moduleRadius: 0,
    eyeRadius: 0,
    dark: BLACK,
    light: WHITE,
  },
  rounded: {
    moduleStyle: 'rounded',
    eyeStyle: 'rounded',
    moduleRadius: 0.25,
    eyeRadius: 0.3,
    dark: BLACK,
    light: WHITE,
  },
};

export const DEFAULT_STYLE = QR_STYLES.rounded;

/** Edge length of a finder pattern, in modules. */
const FINDER_SIZE = 7;

/**
 * Sub-samples per pixel axis. Rounded edges are resolved by coverage rather
 * than a hard inside/outside test, because an aliased curve reads as a ragged
 * module edge to a decoder's binariser.
 */
const SUPERSAMPLE = 3;

/** Top-left origins of the three finder patterns. */
function finderOrigins(size: number): ReadonlyArray<readonly [number, number]> {
  return [
    [0, 0],
    [0, size - FINDER_SIZE],
    [size - FINDER_SIZE, 0],
  ];
}

function isInFinder(size: number, row: number, col: number): boolean {
  return finderOrigins(size).some(
    ([originRow, originCol]) =>
      row >= originRow &&
      row < originRow + FINDER_SIZE &&
      col >= originCol &&
      col < originCol + FINDER_SIZE,
  );
}

/**
 * Inside-test for an axis-aligned rounded rectangle, in module coordinates.
 *
 * Works by clamping the sample into the rectangle's inner "core" (the region
 * inset by the radius) and comparing the distance to that point against the
 * radius — the standard rounded-box distance test.
 */
function inRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): boolean {
  if (x < left || x > right || y < top || y > bottom) return false;

  const limit = Math.min(radius, (right - left) / 2, (bottom - top) / 2);
  if (limit <= 0) return true;

  const coreX = Math.min(Math.max(x, left + limit), right - limit);
  const coreY = Math.min(Math.max(y, top + limit), bottom - limit);
  const dx = x - coreX;
  const dy = y - coreY;
  return dx * dx + dy * dy <= limit * limit;
}

/** Predicate over module-space coordinates. */
type Inside = (x: number, y: number) => boolean;

/**
 * Composite one shape into the buffer over the given module-space bounds.
 *
 * Only the pixels covering those bounds are touched, so painting every module
 * of a large symbol stays linear in output pixels rather than
 * pixels × shapes.
 */
function paint(
  raster: QrRaster,
  scale: number,
  quietZone: number,
  bounds: readonly [number, number, number, number],
  inside: Inside,
  dark: Rgb,
  light: Rgb,
): void {
  const [left, top, right, bottom] = bounds;
  const startX = Math.max(0, Math.floor((left + quietZone) * scale));
  const startY = Math.max(0, Math.floor((top + quietZone) * scale));
  const endX = Math.min(raster.width, Math.ceil((right + quietZone) * scale));
  const endY = Math.min(raster.height, Math.ceil((bottom + quietZone) * scale));

  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      let hits = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        const y = (py + (sy + 0.5) / SUPERSAMPLE) / scale - quietZone;
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / scale - quietZone;
          if (inside(x, y)) hits++;
        }
      }

      if (hits === 0) continue;

      const coverage = hits / samples;
      const offset = (py * raster.width + px) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const existing = raster.data[offset + channel];
        const painted = light[channel] + (dark[channel] - light[channel]) * coverage;
        // Keep whichever is darker so adjacent shapes never lighten each other
        // along a shared edge.
        raster.data[offset + channel] = Math.min(existing, painted);
      }
    }
  }
}

/**
 * Render a module matrix to an RGBA buffer with the given style.
 *
 * Built by hand rather than through a canvas so the identical code path runs
 * in the browser (via `putImageData`) and in Node tests — which is what makes
 * it possible to prove a style still decodes instead of hoping it does.
 *
 * Styling is confined to *shape*. The module grid, its dimensions and the
 * quiet zone are untouched, so a decoder still samples exactly the matrix it
 * would have sampled from a plain black-and-white render.
 */
export function renderQr(
  modules: Uint8Array,
  size: number,
  options: QrRenderOptions = {},
): QrRaster {
  const scale = options.scale ?? 10;
  const quietZone = options.quietZone ?? 4;
  const style: QrStyle = { ...DEFAULT_STYLE, ...options };
  const { dark, light } = style;

  const span = size + quietZone * 2;
  const width = span * scale;
  const data = new Uint8ClampedArray(width * width * 4);

  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = light[0];
    data[offset + 1] = light[1];
    data[offset + 2] = light[2];
    data[offset + 3] = 255;
  }

  const raster: QrRaster = { data, width, height: width };
  const moduleRadius = style.moduleStyle === 'rounded' ? style.moduleRadius : 0;

  // Data modules. Finder cells are skipped and drawn below as whole shapes.
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules[idx(size, row, col)] === 0) continue;
      if (isInFinder(size, row, col)) continue;

      paint(
        raster,
        scale,
        quietZone,
        [col, row, col + 1, row + 1],
        (x, y) => inRoundedRect(x, y, col, row, col + 1, row + 1, moduleRadius),
        dark,
        light,
      );
    }
  }

  // Finder patterns, drawn as a ring plus a centre rather than 49 separate
  // modules. The canonical pattern is a one-module dark border, a one-module
  // light gap and a 3x3 dark centre; carving never touches these cells, so
  // reproducing it geometrically is exact.
  const eyeRadius = style.eyeStyle === 'rounded' ? style.eyeRadius : 0;

  for (const [originRow, originCol] of finderOrigins(size)) {
    const left = originCol;
    const top = originRow;
    const right = originCol + FINDER_SIZE;
    const bottom = originRow + FINDER_SIZE;

    const inside: Inside = (x, y) => {
      const inOuter = inRoundedRect(x, y, left, top, right, bottom, eyeRadius);
      // The light gap is inset one module from the outer edge.
      const inGap = inRoundedRect(
        x,
        y,
        left + 1,
        top + 1,
        right - 1,
        bottom - 1,
        Math.max(0, eyeRadius - 0.15),
      );
      const inCentre = inRoundedRect(
        x,
        y,
        left + 2,
        top + 2,
        right - 2,
        bottom - 2,
        Math.max(0, eyeRadius - 0.3),
      );
      return (inOuter && !inGap) || inCentre;
    };

    paint(raster, scale, quietZone, [left, top, right, bottom], inside, dark, light);
  }

  return raster;
}
