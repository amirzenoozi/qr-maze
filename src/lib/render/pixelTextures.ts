import * as THREE from 'three';
import { mulberry32 } from '../random';

/**
 * Procedural pixel-art textures.
 *
 * Every texture is painted into a tiny canvas (16x16 or smaller) and magnified
 * with `NearestFilter`, so what reaches the screen is honest pixel art rather
 * than a blurred photograph. Generating them in code keeps the project free of
 * binary assets and lets the palette live next to the scene that uses it.
 *
 * The palette is a bright spring morning. Gameplay colour is free to be as
 * light as it likes: scan mode swaps every material for flat black and white,
 * so nothing here can affect whether the symbol decodes.
 */

/** Pick an entry from a palette using `random`. */
function pick(random: () => number, palette: readonly string[]): string {
  return palette[Math.floor(random() * palette.length)];
}

type Painter = (
  context: CanvasRenderingContext2D,
  size: number,
  random: () => number,
) => void;

/** Paint a texture and wrap it with pixel-art-appropriate filtering. */
function createTexture(size: number, seed: number, paint: Painter): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable.');

  paint(context, size, mulberry32(seed));

  const texture = new THREE.CanvasTexture(canvas);
  // Nearest filtering on both axes is what makes the pixels stay square.
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Fill every cell from a palette, one flat colour per pixel. */
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

// Repeated entries bias the result toward the base colour; `pick` is uniform.
const GRASS = ['#7cc24a', '#7cc24a', '#7cc24a', '#8ed455', '#6cb03e', '#9ade63'];
const HEDGE = ['#63ab3c', '#63ab3c', '#579934', '#6fb844'];
const GRAVEL = ['#ebe3c6', '#ebe3c6', '#ebe3c6', '#f2ecd6', '#ddd4b2', '#f7f2e2'];
const BARK = ['#8a6136', '#8a6136', '#74502c', '#9c7245'];
const LEAF = ['#5fb63f', '#5fb63f', '#5fb63f', '#6fc94b', '#52a336', '#82dc5c'];
const WOOD = ['#a56c39', '#a56c39', '#a56c39', '#b57c46', '#915c2e', '#8a5529'];

/** Sunlit grass on top of a hedge block, with a few taller blades. */
const paintGrassTop: Painter = (context, size, random) => {
  speckle(context, size, random, GRASS);

  // Scattered tufts read as blades once magnified.
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(random() * size);
    const y = Math.floor(random() * size);
    context.fillStyle = random() > 0.5 ? '#5da337' : '#a6e874';
    context.fillRect(x, y, 1, Math.min(2, size - y));
  }
};

/** Hedge flank: vertical streaks suggest dense foliage without noise. */
const paintHedgeSide: Painter = (context, size, random) => {
  speckle(context, size, random, HEDGE);

  for (let x = 0; x < size; x += 3) {
    context.fillStyle = random() > 0.5 ? '#549632' : '#79c04d';
    context.fillRect(x, 0, 1, size);
  }

  // A lighter lip along the top edge catches the morning sun.
  context.fillStyle = '#8ed455';
  context.fillRect(0, 0, size, 1);
};

/** Gravel park path. Light and warm, like sunlit stone. */
const paintPath: Painter = (context, size, random) => {
  speckle(context, size, random, GRAVEL);

  // Sparse pebbles, kept small so tiling does not produce visible seams.
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(random() * (size - 1));
    const y = Math.floor(random() * (size - 1));
    context.fillStyle = '#cdc39d';
    context.fillRect(x, y, 1, 1);
  }
};

/** Tree trunk bark. */
const paintBark: Painter = (context, size, random) => {
  speckle(context, size, random, BARK);

  for (let x = 1; x < size; x += 4) {
    context.fillStyle = '#6b4a2a';
    context.fillRect(x, 0, 1, size);
  }
};

/** Tree canopy foliage, with a scatter of white spring blossom. */
const paintLeaves: Painter = (context, size, random) => {
  speckle(context, size, random, LEAF);

  // Clustered highlights so the canopy does not look like uniform static.
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(random() * (size - 2));
    const y = Math.floor(random() * (size - 2));
    context.fillStyle = random() > 0.5 ? '#8ae05f' : '#4a9531';
    context.fillRect(x, y, 2, 2);
  }

  for (let i = 0; i < 5; i++) {
    context.fillStyle = random() > 0.5 ? '#fdf3ff' : '#ffd6ec';
    context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1, 1);
  }
};

/**
 * A single blossom, drawn as petals around a centre with a transparent
 * background so the quad reads as a flower rather than a square.
 */
const paintBlossom: Painter = (context, size, random) => {
  const half = size / 2;
  const petal = pick(random, ['#ffffff', '#ffd9ec', '#ffe066', '#d9c2ff', '#ff9d9d']);

  context.clearRect(0, 0, size, size);

  // Plus-shaped petal arrangement: the most legible flower at 8px.
  context.fillStyle = petal;
  context.fillRect(half - 2, half - 1, 4, 2);
  context.fillRect(half - 1, half - 2, 2, 4);

  context.fillStyle = '#ffd54a';
  context.fillRect(half - 1, half - 1, 2, 2);
};

/**
 * Weathered fence timber. Grain runs along the U axis, so a rail stretched
 * lengthways shows the boards running with it.
 */
const paintWood: Painter = (context, size, random) => {
  speckle(context, size, random, WOOD);

  // Darker seams split the surface into separate boards.
  for (let y = 0; y < size; y += 5) {
    context.fillStyle = '#71441f';
    context.fillRect(0, y, size, 1);
  }

  // Short streaks read as grain once magnified.
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(random() * (size - 3));
    const y = Math.floor(random() * size);
    context.fillStyle = random() > 0.5 ? '#8a5529' : '#c08c55';
    context.fillRect(x, y, 3, 1);
  }

  // A knot, so tiling does not read as a regular weave.
  context.fillStyle = '#6b3f1c';
  context.fillRect(
    Math.floor(random() * (size - 2)),
    Math.floor(random() * (size - 2)),
    2,
    2,
  );
};

/** Chequered finish flag marking the exit. */
const paintChecker: Painter = (context, size) => {
  const cell = size / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      context.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#20242e';
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }
};

/**
 * Textures are built on first use and shared for the lifetime of the page:
 * they are immutable, so every mesh can safely reference the same instance.
 */
interface PixelTextures {
  readonly grassTop: THREE.Texture;
  readonly hedgeSide: THREE.Texture;
  readonly path: THREE.Texture;
  readonly bark: THREE.Texture;
  readonly leaves: THREE.Texture;
  readonly wood: THREE.Texture;
  readonly blossom: THREE.Texture;
  readonly checker: THREE.Texture;
}

let cache: PixelTextures | null = null;

/** Lazily build (and then reuse) the pixel-art texture set. */
export function getPixelTextures(): PixelTextures {
  if (cache) return cache;

  cache = {
    grassTop: createTexture(16, 1337, paintGrassTop),
    hedgeSide: createTexture(16, 4242, paintHedgeSide),
    path: createTexture(16, 909, paintPath),
    bark: createTexture(8, 5150, paintBark),
    leaves: createTexture(16, 7331, paintLeaves),
    wood: createTexture(16, 8642, paintWood),
    blossom: createTexture(8, 2468, paintBlossom),
    checker: createTexture(8, 1, paintChecker),
  };
  return cache;
}
