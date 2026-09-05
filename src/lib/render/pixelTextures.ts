import * as THREE from 'three';
import { mulberry32 } from '../random';
import { THEME, type Surface, type SurfaceStyle, type ThemeId } from './theme';

/**
 * Procedural pixel-art textures.
 *
 * Every texture is painted into a tiny canvas (16x16 or smaller) and magnified
 * with `NearestFilter`, so what reaches the screen is honest pixel art rather
 * than a blurred photograph. Generating them in code keeps the project free of
 * binary assets and lets the palettes live in `theme.ts` next to the furniture
 * they are painted to match.
 *
 * Colour is free to be anything a theme wants. Scan mode swaps every material
 * for flat black and white and unmounts the decoration, so nothing painted
 * here can affect whether the symbol decodes.
 */

/** Pick an entry from a palette using `random`. */
function pick(random: () => number, palette: readonly string[]): string {
  return palette[Math.floor(random() * palette.length)];
}

type Painter = (
  context: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  surface: Surface,
) => void;

/** Fill every cell from the base palette, one flat colour per pixel. */
function speckle(
  context: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  palette: readonly string[],
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      context.fillStyle = pick(random, palette);
      context.fillRect(x, y, 1, 1);
    }
  }
}

/** Flat noise and nothing else. Bark, and anything wanting plain grain. */
const paintSpeckle: Painter = (context, size, random, surface) => {
  speckle(context, size, random, surface.base);

  // A few darker seams stop plain noise from reading as static.
  for (let x = 1; x < size; x += 4) {
    context.fillStyle = surface.dark;
    context.fillRect(x, 0, 1, size);
  }
};

/** Noise plus scattered tufts, which read as blades once magnified. */
const paintTufted: Painter = (context, size, random, surface) => {
  speckle(context, size, random, surface.base);

  for (let i = 0; i < 10; i++) {
    const x = Math.floor(random() * size);
    const y = Math.floor(random() * size);
    context.fillStyle = random() > 0.5 ? surface.dark : surface.light;
    context.fillRect(x, y, 1, Math.min(2, size - y));
  }
};

/** Vertical streaks suggest dense foliage or panelling without noise. */
const paintStreaked: Painter = (context, size, random, surface) => {
  speckle(context, size, random, surface.base);

  for (let x = 0; x < size; x += 3) {
    context.fillStyle = random() > 0.5 ? surface.dark : surface.light;
    context.fillRect(x, 0, 1, size);
  }

  // A lighter lip along the top edge catches the low sun.
  if (surface.edge) {
    context.fillStyle = surface.edge;
    context.fillRect(0, 0, size, 1);
  }
};

/** Noise plus sparse grains, kept small so tiling shows no seam. */
const paintGrains: Painter = (context, size, random, surface) => {
  speckle(context, size, random, surface.base);

  for (let i = 0; i < 6; i++) {
    const x = Math.floor(random() * (size - 1));
    const y = Math.floor(random() * (size - 1));
    context.fillStyle = surface.dark;
    context.fillRect(x, y, 1, 1);
  }
};

/** Clustered highlights and optional specks: a canopy, not uniform static. */
const paintClumped: Painter = (context, size, random, surface) => {
  speckle(context, size, random, surface.base);

  for (let i = 0; i < 8; i++) {
    const x = Math.floor(random() * (size - 2));
    const y = Math.floor(random() * (size - 2));
    context.fillStyle = random() > 0.5 ? surface.light : surface.dark;
    context.fillRect(x, y, 2, 2);
  }

  const specks = surface.specks;
  if (specks?.length) {
    for (let i = 0; i < 5; i++) {
      context.fillStyle = pick(random, specks);
      context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1, 1);
    }
  }
};

/**
 * Weathered timber. Grain runs along the U axis, so a rail stretched
 * lengthways shows the boards running with it.
 */
const paintPlanks: Painter = (context, size, random, surface) => {
  speckle(context, size, random, surface.base);

  // Darker seams split the surface into separate boards.
  if (surface.edge) {
    for (let y = 0; y < size; y += 5) {
      context.fillStyle = surface.edge;
      context.fillRect(0, y, size, 1);
    }
  }

  // Short streaks read as grain once magnified.
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(random() * (size - 3));
    const y = Math.floor(random() * size);
    context.fillStyle = random() > 0.5 ? surface.dark : surface.light;
    context.fillRect(x, y, 3, 1);
  }

  // A knot, so tiling does not read as a regular weave. Its colour is taken
  // directly rather than picked: drawing one random for a one-entry palette
  // would shift every value after it and repaint the whole surface.
  const specks = surface.specks;
  if (specks?.length) {
    context.fillStyle = specks[0];
    context.fillRect(
      Math.floor(random() * (size - 2)),
      Math.floor(random() * (size - 2)),
      2,
      2,
    );
  }
};

/**
 * A single scattered thing, drawn as petals around a centre on a transparent
 * background so the quad reads as an object rather than a square.
 */
const paintPetal: Painter = (context, size, random, surface) => {
  const half = size / 2;
  const petal = pick(random, surface.base);

  context.clearRect(0, 0, size, size);

  // Plus-shaped arrangement: the most legible flower at 8px.
  context.fillStyle = petal;
  context.fillRect(half - 2, half - 1, 4, 2);
  context.fillRect(half - 1, half - 2, 2, 4);

  context.fillStyle = surface.light;
  context.fillRect(half - 1, half - 1, 2, 2);
};

/** A solid face, optionally lit along its top edge. */
const paintFlat: Painter = (context, size, _random, surface) => {
  context.fillStyle = surface.base[0];
  context.fillRect(0, 0, size, size);

  if (surface.edge) {
    context.fillStyle = surface.edge;
    context.fillRect(0, 0, size, 1);
    context.fillRect(0, size - 1, size, 1);
  }
};

/** Cell spacing for `grid`, in texture pixels. */
const GRID_SPACING = 8;

/** A solid field under a lattice, brightened where the lines cross. */
const paintGrid: Painter = (context, size, _random, surface) => {
  context.fillStyle = surface.base[0];
  context.fillRect(0, 0, size, size);

  context.fillStyle = surface.light;
  for (let i = 0; i < size; i += GRID_SPACING) {
    context.fillRect(i, 0, 1, size);
    context.fillRect(0, i, size, 1);
  }

  // The crossings carry the eye along the lattice; without them a grid at
  // this resolution reads as two unrelated sets of stripes.
  context.fillStyle = surface.dark;
  for (let y = 0; y < size; y += GRID_SPACING) {
    for (let x = 0; x < size; x += GRID_SPACING) {
      context.fillRect(x, y, 1, 1);
    }
  }
};

/** Spacing between the horizontal runs a `traces` surface lays down. */
const TRACE_SPACING = 5;

/**
 * Copper on solder mask: horizontal runs that turn a corner and end in a pad.
 *
 * Real traces are mostly straight with 45-degree turns, but a diagonal at this
 * resolution is a staircase of single pixels that reads as noise. Right angles
 * and round pads are what survive being magnified.
 */
const paintTraces: Painter = (context, size, random, surface) => {
  context.fillStyle = surface.base[0];
  context.fillRect(0, 0, size, size);

  for (let y = 1; y < size; y += TRACE_SPACING) {
    const start = Math.floor(random() * (size / 2));
    const end = start + Math.floor(random() * (size - start));

    context.fillStyle = surface.light;
    context.fillRect(start, y, end - start, 1);

    // A vertical stub turning off the run, so the board is not just stripes.
    const turn = random();
    if (turn > 0.45) {
      const drop = Math.min(TRACE_SPACING - 1, 1 + Math.floor(random() * 3));
      context.fillRect(end - 1, y, 1, drop);
    }

    // The pad at the end of a run is the thing that says "circuit".
    context.fillRect(Math.max(0, end - 2), Math.max(0, y - 1), 2, 2);
  }

  // Darker relief under a few runs, so the copper sits on the board rather
  // than floating on it.
  context.fillStyle = surface.dark;
  for (let i = 0; i < 4; i++) {
    context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1, 1);
  }
};

/** Thickness range of one sedimentary band, in texture pixels. */
const STRATA_MIN = 2;
const STRATA_MAX = 4;

/** Sedimentary banding: horizontal layers of slightly different tone. */
const paintStrata: Painter = (context, size, random, surface) => {
  speckle(context, size, random, surface.base);

  let y = 0;
  while (y < size) {
    const depth = STRATA_MIN + Math.floor(random() * (STRATA_MAX - STRATA_MIN + 1));
    const tone = random();

    // Only about half the bands are tinted. Colouring every one turns rock
    // into corduroy.
    if (tone > 0.5) {
      context.fillStyle = tone > 0.75 ? surface.light : surface.dark;
      context.fillRect(0, y, size, Math.min(depth, size - y));
    }

    y += depth;
  }

  // A wind-scoured highlight along the top, where the block catches the sun.
  if (surface.edge) {
    context.fillStyle = surface.edge;
    context.fillRect(0, 0, size, 1);
  }
};

const PAINTERS: Record<SurfaceStyle, Painter> = {
  speckle: paintSpeckle,
  tufted: paintTufted,
  streaked: paintStreaked,
  grains: paintGrains,
  clumped: paintClumped,
  planks: paintPlanks,
  petal: paintPetal,
  flat: paintFlat,
  grid: paintGrid,
  traces: paintTraces,
  strata: paintStrata,
};

/** Paint a surface and wrap it with pixel-art-appropriate filtering. */
function createTexture(size: number, seed: number, surface: Surface): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable.');

  PAINTERS[surface.style](context, size, mulberry32(seed), surface);

  const texture = new THREE.CanvasTexture(canvas);
  // Nearest filtering on both axes is what makes the pixels stay square.
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Chequered finish flag marking the exit. */
function createChecker(colours: readonly [string, string]): THREE.Texture {
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable.');

  const cell = size / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      context.fillStyle = (x + y) % 2 === 0 ? colours[0] : colours[1];
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Textures are built on first use and shared for the lifetime of the page:
 * they are immutable, so every mesh can safely reference the same instance.
 *
 * A consumer needing its own `repeat` clones the texture rather than mutating
 * these; three.js reference-counts the underlying image, so the cached
 * original survives the clone being disposed.
 */
export interface PixelTextures {
  readonly grassTop: THREE.Texture;
  readonly hedgeSide: THREE.Texture;
  readonly path: THREE.Texture;
  readonly bark: THREE.Texture;
  readonly leaves: THREE.Texture;
  readonly wood: THREE.Texture;
  readonly blossom: THREE.Texture;
  readonly checker: THREE.Texture;
}

/**
 * Fixed seeds, so a given theme paints the same textures every time. They are
 * shared across themes on purpose: the same seed under different palettes puts
 * the tufts and knots in the same places, which makes two themes comparable
 * rather than two unrelated piles of noise.
 */
const SEEDS = {
  grassTop: 1337,
  hedgeSide: 4242,
  path: 909,
  bark: 5150,
  leaves: 7331,
  wood: 8642,
  blossom: 2468,
} as const;

const cache = new Map<ThemeId, PixelTextures>();

/** Lazily build (and then reuse) one theme's pixel-art texture set. */
export function getPixelTextures(themeId: ThemeId): PixelTextures {
  const cached = cache.get(themeId);
  if (cached) return cached;

  const { surfaces, decor } = THEME[themeId];

  const textures: PixelTextures = {
    grassTop: createTexture(16, SEEDS.grassTop, surfaces.wallTop),
    hedgeSide: createTexture(16, SEEDS.hedgeSide, surfaces.wallSide),
    path: createTexture(16, SEEDS.path, surfaces.floor),
    bark: createTexture(8, SEEDS.bark, surfaces.trunk),
    leaves: createTexture(16, SEEDS.leaves, surfaces.crown),
    wood: createTexture(16, SEEDS.wood, surfaces.border),
    blossom: createTexture(8, SEEDS.blossom, surfaces.scatter),
    checker: createChecker(decor.exit.flagColours),
  };

  cache.set(themeId, textures);
  return textures;
}
