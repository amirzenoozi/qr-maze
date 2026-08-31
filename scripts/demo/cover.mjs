// Builds a YouTube cover from the live game rather than from a video frame.
//
// A frame lifted out of the recording carries the HUD, the scan badge and
// whatever compression the encoder left behind. Driving the game directly
// lets the shot be composed on purpose: walk the sphere somewhere
// photogenic, hide the interface, and screenshot at full quality. The QR on
// the cover is the app's own canvas, so it is the same verified bitmap the
// video shows.
//
// ffmpeg here has no drawtext filter, so the title is laid out as DOM in the
// game's own Press Start 2P face and screenshotted with everything else.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const SITE = process.env.DEMO_URL ?? 'https://amirzenoozi.github.io/qr-maze/';
const PLAN_FILE = process.argv[2] ?? '/tmp/qrm-demo/moves.json';
const OUT_FILE = process.argv[3] ?? path.join(os.homedir(), 'Desktop/qr-maze-cover.png');
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
// Mid-route. Later than this and the follow camera reaches the board edge,
// which trades the wall-to-wall maze for fence, gravel and sky.
const WALK_STEPS = Number(process.env.DEMO_STEPS ?? 34);
const MOVE_MS = 60;

const plan = JSON.parse(await fs.readFile(PLAN_FILE, 'utf8'));
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
await page.getByRole('button', { name: 'Build maze' }).click();
await page.locator('.screen--game').waitFor({ timeout: 25_000 });
await page.waitForTimeout(1200);

for (const key of plan.keys.slice(0, WALK_STEPS)) {
  await page.keyboard.press(key);
  await page.waitForTimeout(MOVE_MS);
}
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
  content: '.hud__stats, .hud__controls, .scan-badge, .scan-backdrop { display: none !important; }',
});
await page.waitForTimeout(300);
const hero = await page.screenshot({ type: 'png' });
await game.close();

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
      rgb(8 16 32 / 92%) 0%,
      rgb(8 16 32 / 82%) 34%,
      rgb(8 16 32 / 28%) 58%,
      rgb(8 16 32 / 6%) 100%);
  }
  .copy {
    position: absolute; left: 56px; top: 50%; transform: translateY(-50%);
    display: flex; flex-direction: column; gap: 22px;
    font-family: 'Press Start 2P', monospace;
    max-width: 660px;
  }
  .kicker {
    font-size: 15px; letter-spacing: 3px; color: #7de2ff;
    text-shadow: 3px 3px 0 #0a1120;
  }
  .title {
    font-size: 76px; line-height: 1.16; color: #ffffff;
    text-shadow: 6px 6px 0 #0a1120, 0 0 34px rgb(125 226 255 / 45%);
  }
  .title em { font-style: normal; color: #8ce05a; }
  .blurb {
    font-size: 17px; line-height: 1.85; color: #cbd9f2;
    text-shadow: 3px 3px 0 #0a1120;
  }
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
