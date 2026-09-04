// Builds a cover image from the live game rather than from a video frame.
//
// A frame lifted out of a recording carries the HUD, the scan badge and
// whatever compression the encoder left behind. Driving the game directly
// lets the shot be composed on purpose: pick a body, walk somewhere
// photogenic, drop the sky to night, hide the interface, and screenshot at
// full quality. The QR on the cover is the app's own canvas, so it is the
// same verified bitmap the game hands out as a play link.
//
// ffmpeg here has no drawtext filter, so the title is laid out as DOM in the
// game's own Press Start 2P face and screenshotted with everything else.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const SITE = process.env.DEMO_URL ?? 'https://amirzenoozi.github.io/qr-maze/';
const OUT_FILE = process.argv[2] ?? path.join(os.homedir(), 'Desktop/qr-maze-cover.png');
const FONT_FILE =
  process.env.DEMO_FONT ??
  path.join(
    process.cwd(),
    'node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2',
  );
const EXECUTABLE =
  process.env.DEMO_CHROME ??
  path.join(
    os.homedir(),
    'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64',
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  );

// YouTube wants 1280x720 at minimum and shows the thumbnail as small as
// ~210px wide in a sidebar, so the title has to survive a 6x downscale.
const WIDTH = 1280;
const HEIGHT = 720;
const HERO_SCALE = 2;

// Lava reads best against night: the crust is dark, the veins are its own
// emissive map, so the body lights the hedges instead of sitting flat on
// them. Override with DEMO_SKIN to shoot any of the nine.
const SKIN = process.env.DEMO_SKIN ?? 'Lava';
// Normal widens without plugging, so the board is open enough to walk
// deep into for a photograph but still reads as a dense grid.
const DIFFICULTY = process.env.DEMO_TIER ?? 'Normal';
// Night is the more dramatic frame and it advertises two features at once,
// the sky switch and the fact that the body is the only moving light.
const NIGHT = process.env.DEMO_SKY !== 'day';

// Rows walked, not presses. The camera trails the player along Z, which is
// the grid row, so only downward progress changes what is in frame. Much
// past this and the far fence and gravel climb into the bottom of the shot.
const WALK_ROWS = Number(process.env.DEMO_ROWS ?? 17);
const MOVE_MS = 70;

const font = await fs.readFile(FONT_FILE);

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars'],
});

// The hero is grabbed at 2x and let the cover downscale it. Unlike the video
// this is a still, so a sharper source only helps.
const game = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: HERO_SCALE,
});
const page = await game.newPage();

await page.goto(SITE, { waitUntil: 'load' });
await page.getByRole('button', { name: DIFFICULTY, exact: true }).click();
await page.getByRole('button', { name: SKIN, exact: true }).click();
await page.getByRole('button', { name: 'Build maze' }).click();
await page.locator('.screen--game').waitFor({ timeout: 25_000 });
await page.waitForTimeout(1200);

// The sky now opens on the visitor's own clock, so pressing N blindly is a
// coin flip. Ask the HUD instead: the button offers the sky you are not in.
const wanted = NIGHT ? 'Night' : 'Day';
if ((await page.getByRole('button', { name: wanted, exact: true }).count()) > 0) {
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
}

// The board is re-routed on every visit, so a key sequence computed offline
// no longer fits it. Walk greedily instead and let the move counter say
// whether a press landed: the store refuses a step into a hedge without
// charging for it, so a refused key is free to try.
const budget = page.locator('.hud__stats .stat__value').first();
const movesLeft = async () => Number((await budget.textContent()).replace(/\D/g, ''));

const REVERSE = {
  ArrowDown: 'ArrowUp',
  ArrowUp: 'ArrowDown',
  ArrowRight: 'ArrowLeft',
  ArrowLeft: 'ArrowRight',
};
const GAIN = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 0, ArrowLeft: 0 };

// Count net rows gained rather than raw presses. A board full of dead ends
// spends plenty of steps sidestepping and backing out, and none of those
// move the camera down the board.
let last = null;
let depth = 0;

for (let attempt = 0; attempt < WALK_ROWS * 20 && depth < WALK_ROWS; attempt += 1) {
  // Down and right first because the exit is the bottom-right corner. The
  // way we came is tried last rather than banned, or a dead end ends the walk.
  const order = ['ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowUp'].sort(
    (a, b) => (a === REVERSE[last] ? 1 : 0) - (b === REVERSE[last] ? 1 : 0),
  );
  let moved = false;
  for (const key of order) {
    const before = await movesLeft();
    await page.keyboard.press(key);
    await page.waitForTimeout(MOVE_MS);
    if ((await movesLeft()) !== before) {
      last = key;
      depth += GAIN[key];
      moved = true;
      break;
    }
  }
  if (!moved) break;
}
console.log(`walked down ${depth} rows`);
await page.waitForTimeout(600);

// Pull the play-link QR straight off the app's canvas before the interface
// is hidden, so the cover advertises a code that actually resolves.
await page.getByRole('button', { name: 'Enlarge the QR code' }).click();
await page.getByRole('button', { name: 'Play link' }).click();
await page.waitForTimeout(500);
const qr = await page.locator('.scan-badge__code').evaluate((node) => node.toDataURL('image/png'));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.addStyleTag({
  content:
    '.hud__stats, .hud__lives, .hud__controls, .hud__paused, .scan-badge, .scan-backdrop { display: none !important; }',
});
await page.waitForTimeout(300);
const hero = await page.screenshot({ type: 'png' });
await game.close();

// Same six rectangles the in-game heart is built from, on the same 8x7 grid,
// so the badge on the cover is the badge in the HUD.
const HEART = [
  [1, 0, 2, 1],
  [5, 0, 2, 1],
  [0, 1, 8, 3],
  [1, 4, 6, 1],
  [2, 5, 4, 1],
  [3, 6, 2, 1],
];
const heart = `<svg class="heart" viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true">${HEART.map(
  ([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`,
).join('')}</svg>`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Press Start 2P';
    src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; position: relative; }
  .hero {
    position: absolute; inset: 0;
    width: 100%; height: 100%; object-fit: cover;
    image-rendering: pixelated;
  }
  /* Darkened from the left so the title has contrast without hiding the
     maze, which is the thing that has to be recognisable at sidebar size. */
  .wash {
    position: absolute; inset: 0;
    background: linear-gradient(100deg,
      rgb(8 16 32 / 93%) 0%,
      rgb(8 16 32 / 84%) 34%,
      rgb(8 16 32 / 30%) 58%,
      rgb(8 16 32 / 6%) 100%);
  }
  .copy {
    position: absolute; left: 56px; top: 50%; transform: translateY(-50%);
    display: flex; flex-direction: column; gap: 20px;
    font-family: 'Press Start 2P', monospace;
    max-width: 640px;
  }
  .kicker {
    font-size: 14px; letter-spacing: 3px; color: #7de2ff;
    text-shadow: 3px 3px 0 #0a1120;
  }
  .title {
    font-size: 74px; line-height: 1.16; color: #ffffff;
    text-shadow: 6px 6px 0 #0a1120, 0 0 34px rgb(125 226 255 / 45%);
  }
  .title em { font-style: normal; color: #8ce05a; }
  .blurb {
    font-size: 16px; line-height: 1.85; color: #cbd9f2;
    text-shadow: 3px 3px 0 #0a1120;
  }
  /* The chips carry the pixel chrome of the game's own buttons: square
     corners, hard offset shadow, no gradient anywhere. */
  .chips { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .chip {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 11px;
    background: #16233d; border: 3px solid #3d558a;
    box-shadow: 4px 4px 0 #0a1120;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px; letter-spacing: 1px; color: #e6ecf7;
  }
  .heart { width: 13px; height: 12px; fill: #ff8a7a; display: block; }
  .badge {
    position: absolute; right: 52px; bottom: 52px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 14px; background: #ffffff;
    border: 6px solid #0a1120; box-shadow: 10px 10px 0 rgb(10 17 32 / 55%);
  }
  .badge img { width: 178px; height: 178px; display: block; image-rendering: auto; }
  .badge span {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px; letter-spacing: 1px; color: #16233d;
  }
</style></head><body>
  <img class="hero" src="data:image/png;base64,${hero.toString('base64')}">
  <div class="wash"></div>
  <div class="copy">
    <p class="kicker">A SCANNABLE QR CODE</p>
    <h1 class="title">PLAY THE<br><em>QR CODE</em></h1>
    <p class="blurb">Every dark module is a hedge.<br>Solve the maze, then scan it.</p>
    <div class="chips">
      <span class="chip">9 BODIES</span>
      <span class="chip">DAY / NIGHT</span>
      <span class="chip">4 DIFFICULTIES</span>
      <span class="chip">${heart}${heart}${heart}</span>
    </div>
  </div>
  <div class="badge"><img src="${qr}"><span>SCAN TO PLAY</span></div>
</body></html>`;

const shot = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
const cover = await shot.newPage();
await cover.setContent(html, { waitUntil: 'load' });
await cover.evaluate(() => document.fonts.ready);
await cover.waitForTimeout(400);
await cover.screenshot({ path: OUT_FILE, type: 'png' });
await shot.close();
await browser.close();

console.log(`cover: ${OUT_FILE}`);
