// Records a scripted playthrough to video.
//
// The run is fully deterministic: `solve.ts` computes the winning key sequence
// ahead of time, so the recording never has to watch the game to know where to
// go. Chromium is launched with the Metal ANGLE backend, which gives the WebGL
// scene real GPU acceleration even headless — software rendering drops the
// frame rate far below what a 60fps capture needs.
//
// Usage:
//   npm i -D playwright-core   (or install it in a scratch dir)
//   npx vite-node scripts/demo/solve.ts "<url>" > /tmp/moves.json
//   node scripts/demo/record.mjs /tmp/moves.json /tmp/raw.webm
//
// It records the *deployed* site by default, not a local preview, so the
// "Play link" QR encodes a URL anyone watching can actually scan.

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SITE = process.env.DEMO_URL ?? 'https://amirzenoozi.github.io/qr-maze/';
const PLAN_FILE = process.argv[2] ?? '/tmp/qrm-demo/moves.json';
const VIDEO_FILE = process.argv[3] ?? '/tmp/qrm-demo/raw.webm';

// playwright-core does not ship browsers; point it at the shared cache.
const EXECUTABLE =
  process.env.DEMO_CHROME ??
  path.join(
    os.homedir(),
    'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64',
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  );

const OUT = path.join(path.dirname(VIDEO_FILE), 'out');

// Capture is 1:1 with the layout. A device scale above 1 does not enlarge the
// recording — Playwright pads the extra area with grey — and supersampling
// would be wrong here anyway: the scene is nearest-neighbour pixel art, so a
// smoothed downsample softens exactly the edges that carry the style. The
// upscale to a higher YouTube tier happens in encode.sh with a nearest filter.
const WIDTH = 1920;
const HEIGHT = 1080;
const VIDEO_WIDTH = WIDTH;
const VIDEO_HEIGHT = HEIGHT;

const MOVE_MS = 150;
/**
 * Two kinds of mistake, because they read differently on screen. A detour is a
 * real walk down a side branch and back, which is unmistakable and also shows
 * the board has branches at all. A bump is a press the hedges refuse: the game
 * gives no collision feedback, so on its own it looks like hesitation, but next
 * to a detour it lands as "that way is blocked".
 */
const DETOUR_AT = [0.22, 0.62];
const DETOUR_PAUSE_MS = 320;
const BUMP_AT = [0.42, 0.85];
const BUMP_PRESS_MS = 280;
const BUMP_SETTLE_MS = 420;
/** Keep the two kinds of mistake from landing on top of each other. */
const MISTAKE_GAP = 4;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
const marks = [];
let origin = 0;
const mark = (name) => marks.push({ name, at: Math.round(performance.now() - origin) });

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  headless: true,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars'],
});

const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } },
});
const page = await context.newPage();
page.on('pageerror', (error) => console.log('[pageerror]', error.message));

await page.goto(SITE, { waitUntil: 'load' });
await page.waitForTimeout(600);
origin = performance.now();
mark('start-screen');

// 1. Let the entry screen read: the prefilled URL is the level seed.
await page.waitForTimeout(2400);
await page.getByRole('button', { name: 'Build maze' }).click();
mark('loading');

await page.locator('.screen--game').waitFor({ timeout: 25000 });
mark('game');
await page.waitForTimeout(2200);

// 2. Walk the route, wandering off it twice and shouldering into a hedge twice.
const keys = plan.keys;
const blocked = plan.blocked ?? [];
const detours = plan.detours ?? [];
/** Steps already carrying a mistake, so the two kinds never collide. */
const claimed = [];

/** Finds the step nearest `fraction` that `offers` something usable. */
function nearestStep(fraction, offers) {
  const wanted = Math.round(keys.length * fraction);
  for (let offset = 0; offset < 8; offset += 1) {
    for (const step of [wanted + offset, wanted - offset]) {
      if (step < 1 || step >= keys.length) continue;
      if (claimed.some((taken) => Math.abs(taken - step) < MISTAKE_GAP)) continue;
      const value = offers(step);
      if (value) {
        claimed.push(step);
        return { step, value };
      }
    }
  }
  return null;
}

/**
 * Picks the wall to bump into at a given step. A key perpendicular to the way
 * we came reads as a wrong turn; reversing just looks like a stutter, so it is
 * only used when the cell offers nothing else.
 */
function wrongKey(step) {
  const options = blocked[step] ?? [];
  if (options.length === 0) return null;
  const came = keys[step - 1];
  const reverse = { ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' }[came];
  return options.find((key) => key !== reverse) ?? options[0];
}

// Detours are placed first: far fewer cells offer one, so they get the pick of
// the route and the bumps fill in around them.
const strays = new Map();
for (const fraction of DETOUR_AT) {
  const found = nearestStep(fraction, (step) => detours[step]);
  if (found) strays.set(found.step, found.value);
}

const bumps = new Map();
for (const fraction of BUMP_AT) {
  const found = nearestStep(fraction, wrongKey);
  if (found) bumps.set(found.step, found.value);
}

console.log('detours:', [...strays].map(([step, path]) => `${step}:${path.length}`).join(' '));
console.log('bumps:', [...bumps].map(([step, key]) => `${step}:${key}`).join(' '));

for (let step = 0; step < keys.length; step += 1) {
  const stray = strays.get(step);
  if (stray) {
    // A walkable wrong turn: out along a dead-end branch, then back to the
    // route. The keys are precomputed as an out-and-back pair, so the run
    // lands on exactly the cell it left.
    // The pause sits at the far end, where the branch runs out, so the viewer
    // reads a dead end rather than an aimless wobble.
    mark(`detour-${step}`);
    const half = stray.length / 2;
    for (const [index, key] of stray.entries()) {
      await page.keyboard.press(key);
      await page.waitForTimeout(MOVE_MS);
      if (index === half - 1) await page.waitForTimeout(DETOUR_PAUSE_MS);
    }
    await page.waitForTimeout(DETOUR_PAUSE_MS);
  }

  const wrong = bumps.get(step);
  if (wrong) {
    // The store refuses a move into a wall, so the sphere stays put and the
    // run stays on its computed route.
    mark(`bump-${step}`);
    await page.keyboard.press(wrong);
    await page.waitForTimeout(BUMP_PRESS_MS);
    await page.keyboard.press(wrong);
    await page.waitForTimeout(BUMP_SETTLE_MS);
  }

  await page.keyboard.press(keys[step]);
  await page.waitForTimeout(MOVE_MS);
}

mark('win');
await page.locator('.win').waitFor({ timeout: 5000 });
await page.waitForTimeout(4200);

// 5. Open the scan card from the win panel.
await page.getByRole('button', { name: 'Scan the code' }).click();
mark('scan-card');
await page.waitForTimeout(3400);

// 6. Switch to the shareable play link.
await page.getByRole('button', { name: 'Play link' }).click();
mark('play-link');
await page.waitForTimeout(3800);

mark('end');
const video = page.video();
await context.close();
await browser.close();

fs.renameSync(await video.path(), VIDEO_FILE);
fs.writeFileSync(`${VIDEO_FILE}.marks.json`, `${JSON.stringify(marks, null, 2)}\n`);
console.log(marks.map((entry) => `${entry.name} ${(entry.at / 1000).toFixed(2)}s`).join('\n'));
