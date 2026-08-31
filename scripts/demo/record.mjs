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
const WIDTH = 1920;
const HEIGHT = 1080;
const MOVE_MS = 150;
const FIRST_LEG = 0.45;

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
  recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } },
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

// 2. Walk the first stretch of the route.
const keys = plan.keys;
const firstLeg = Math.round(keys.length * FIRST_LEG);
for (let step = 0; step < firstLeg; step += 1) {
  await page.keyboard.press(keys[step]);
  await page.waitForTimeout(MOVE_MS);
}

// 3. Show the top-down view, which is the same board a scanner sees.
mark('top-view');
await page.keyboard.press('KeyC');
await page.waitForTimeout(3200);
await page.keyboard.press('KeyC');
await page.waitForTimeout(1000);
mark('resume');

// 4. Finish the route.
for (let step = firstLeg; step < keys.length; step += 1) {
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
