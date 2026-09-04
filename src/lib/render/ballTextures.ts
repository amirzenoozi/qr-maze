import * as THREE from 'three';
import { mulberry32 } from '../random';

/**
 * Equirectangular skins for the player's round bodies.
 *
 * Painted into a small canvas and magnified with `NearestFilter`, like the
 * world's textures, so a ball is pixel art rather than a smoothed photograph.
 *
 * The maps are deliberately coarse and high-contrast. The scene renders at 45%
 * resolution and the body is about 0.3 units across, so it lands on screen at
 * a few dozen pixels: only bold, large features survive. Anything finer would
 * be work nobody can see.
 *
 * `U` wraps around the ball and `V` runs pole to pole, so a horizontal band is
 * a ring and a vertical stripe is a meridian.
 */
export type BallTextureId = 'lava' | 'football' | 'basketball' | 'pokeball' | 'mars';

const WIDTH = 64;
const HEIGHT = 32;

type Painter = (context: CanvasRenderingContext2D, random: () => number) => void;

function fill(context: CanvasRenderingContext2D, color: string): void {
  context.fillStyle = color;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

/** Scatter single pixels so a flat colour still reads as a surface. */
function speckle(
  context: CanvasRenderingContext2D,
  random: () => number,
  palette: readonly string[],
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    context.fillStyle = palette[Math.floor(random() * palette.length)];
    context.fillRect(Math.floor(random() * WIDTH), Math.floor(random() * HEIGHT), 1, 1);
  }
}

/**
 * A blob centred on a point, wrapped horizontally.
 *
 * Drawing twice, once shifted a full width, is what stops a shape that
 * straddles the seam from being clipped in half.
 */
function blob(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string,
): void {
  context.fillStyle = color;
  for (const offset of [-WIDTH, 0, WIDTH]) {
    context.beginPath();
    context.ellipse(centerX + offset, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
  }
}

const paintLava: Painter = (context, random) => {
  fill(context, '#2a211d');
  speckle(context, random, ['#3a2c26', '#241c19', '#453329'], 260);

  // Veins crawl from a handful of sources. They are the only bright thing in
  // the map, which is what lets the same texture double as the emissive map:
  // the crust stays dark and only the cracks light up.
  for (let vein = 0; vein < 14; vein += 1) {
    let x = Math.floor(random() * WIDTH);
    let y = Math.floor(random() * HEIGHT);
    const length = 6 + Math.floor(random() * 10);
    for (let step = 0; step < length; step += 1) {
      context.fillStyle = random() < 0.35 ? '#ffb347' : '#ff5a12';
      context.fillRect(((x % WIDTH) + WIDTH) % WIDTH, y, 1, 1);
      x += Math.floor(random() * 3) - 1;
      y = Math.max(0, Math.min(HEIGHT - 1, y + Math.floor(random() * 3) - 1));
    }
  }
};

const paintFootball: Painter = (context, random) => {
  fill(context, '#f2f2ee');
  speckle(context, random, ['#e2e2dc', '#ffffff'], 140);

  // A truncated icosahedron has twelve black pentagons. Placing them on a
  // staggered grid rather than at random keeps the spacing even once the map
  // is wrapped onto a sphere, where random placement clumps at the poles.
  const rows = [
    { y: 5, count: 4, offset: 0 },
    { y: 15, count: 5, offset: 0.5 },
    { y: 25, count: 4, offset: 0 },
  ];
  for (const row of rows) {
    for (let index = 0; index < row.count; index += 1) {
      const x = ((index + row.offset) / row.count) * WIDTH;
      blob(context, x, row.y, 4.2, 3.4, '#191919');
    }
  }
};

const paintBasketball: Painter = (context, random) => {
  fill(context, '#d96f1e');
  speckle(context, random, ['#e88a3a', '#c25d16', '#b95410'], 420);

  context.fillStyle = '#17110c';
  // Two meridians and the equator: the three great circles that read as a
  // basketball from any angle the follow camera can reach.
  for (const x of [Math.round(WIDTH * 0.25), Math.round(WIDTH * 0.75)]) {
    context.fillRect(x, 0, 2, HEIGHT);
  }
  context.fillRect(0, Math.round(HEIGHT * 0.5) - 1, WIDTH, 2);

  // The two curved seams, drawn as shallow arcs across the free quarters.
  for (const start of [0, WIDTH * 0.5]) {
    for (let step = 0; step < WIDTH * 0.25; step += 1) {
      const x = Math.round(start + step);
      const bend = Math.sin((step / (WIDTH * 0.25)) * Math.PI) * 5;
      context.fillRect(x, Math.round(HEIGHT * 0.5 - 8 + bend), 1, 2);
      context.fillRect(x, Math.round(HEIGHT * 0.5 + 8 - bend), 1, 2);
    }
  }
};

const paintPokeball: Painter = (context) => {
  const band = Math.round(HEIGHT * 0.5);
  context.fillStyle = '#e3350d';
  context.fillRect(0, 0, WIDTH, band - 2);
  context.fillStyle = '#f4f4f2';
  context.fillRect(0, band + 2, WIDTH, HEIGHT - band - 2);
  context.fillStyle = '#141414';
  context.fillRect(0, band - 2, WIDTH, 4);

  // The catch button, on one side only. At u = 0.5 it faces the camera for
  // half of every roll, which is when the body is unmistakable.
  blob(context, WIDTH * 0.5, band, 6, 5, '#141414');
  blob(context, WIDTH * 0.5, band, 4, 3.4, '#f4f4f2');
};

const paintMars: Painter = (context, random) => {
  fill(context, '#b5502a');
  speckle(context, random, ['#c25e33', '#9c4222', '#d1774a'], 520);

  // Maria and dust basins. Only their scale matters at this size, so they are
  // scattered rather than mapped to anything real.
  for (let patch = 0; patch < 10; patch += 1) {
    const dark = random() < 0.6;
    blob(
      context,
      random() * WIDTH,
      4 + random() * (HEIGHT - 8),
      3 + random() * 6,
      2 + random() * 3,
      dark ? '#7f351a' : '#d98b52',
    );
  }

  // Polar caps, which are the one feature that says Mars rather than "rock".
  context.fillStyle = '#e9e2d4';
  context.fillRect(0, 0, WIDTH, 2);
  context.fillRect(0, HEIGHT - 2, WIDTH, 2);
};

const PAINTERS: Record<BallTextureId, { readonly paint: Painter; readonly seed: number }> = {
  lava: { paint: paintLava, seed: 60613 },
  football: { paint: paintFootball, seed: 1863 },
  basketball: { paint: paintBasketball, seed: 2891 },
  pokeball: { paint: paintPokeball, seed: 151 },
  mars: { paint: paintMars, seed: 6779 },
};

function createTexture(id: BallTextureId): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  const { paint, seed } = PAINTERS[id];
  context.imageSmoothingEnabled = false;
  paint(context, mulberry32(seed));

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  // Wrapping around the ball, clamped at the poles: repeating vertically would
  // mirror the northern cap onto the southern one.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

const cache = new Map<BallTextureId, THREE.Texture>();

/**
 * The map for one body, built on first use and shared for the page's lifetime.
 *
 * Browser only, and only ever reached from the render tree, so there is no
 * document to guard against.
 */
export function getBallTexture(id: BallTextureId): THREE.Texture {
  const existing = cache.get(id);
  if (existing) return existing;

  const texture = createTexture(id);
  cache.set(id, texture);
  return texture;
}
