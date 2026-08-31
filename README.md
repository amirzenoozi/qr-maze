# QR Maze

Give it a link. It becomes a real, scannable QR code — and a park you have to walk through.

**[Play it →](https://amirzenoozi.github.io/qr-maze/)**

QR Maze turns any URL into a playable 3D level. The dark modules of the QR
symbol become hedges, the light modules become footpaths, and you walk a glowing
sphere from the top-left corner to the bottom-right. The catch: the code is not
a decoration. It is the real thing, and it still scans after the maze has been
carved into it.

---

## Contents

- [How it works](#how-it-works)
- [Playing](#playing)
- [Running it locally](#running-it-locally)
- [Project layout](#project-layout)
- [The interesting problems](#the-interesting-problems)
- [Inspecting a level](#inspecting-a-level)
- [Testing](#testing)
- [Deployment](#deployment)
- [Tech stack](#tech-stack)

---

## How it works

A QR code is already a grid of black and white cells. That looks like a maze,
but it is not one: the symbol is a scatter of disconnected blobs with no route
through it. Turning one into a level means editing it — and every edited module
eats into the error correction that keeps the code readable.

The pipeline is five gates. A level is only accepted if it clears all of them.

```
URL
 │
 ├─ 1. encode            qrcode → module matrix at error-correction level L
 │
 ├─ 2. reserve           mark finder patterns, alignment patterns, timing
 │                       lines, format and version strips as untouchable
 │
 ├─ 3. carve             0-1 shortest path from the bottom-right exit to the
 │                       nearest top/left border cell, opening the minimum
 │                       number of dark modules
 │
 ├─ 4. budget + verify   damage within the level's budget, then decode the
 │                       result with a real scanner and compare to the URL
 │
 └─ 5. analyse           breadth-first: is it solvable, how short is the best
                         route, how many distinct shortest routes exist
```

If any gate fails, the error-correction level steps up — `L → M → Q → H` — and
the whole thing runs again with a bigger damage budget.

### Why raising the level helps

A common misconception is that a higher error-correction level makes paths
appear. It does not. QR data masking is effectively random, so a raw symbol
almost never contains a natural corridor at any level.

What a higher level actually buys is a larger **damage budget**:

| Level | Recoverable | Used for |
|-------|-------------|----------|
| L     | ~7%         | default — nearly always enough |
| M     | ~15%        | |
| Q     | ~25%        | |
| H     | ~30%        | last resort |

In practice level L wins every time, because the carver is stingy. Real numbers
from `scripts/inspect.ts`:

| URL | Version | Size | Carved | Damage | Moves | Winning routes |
|-----|---------|------|--------|--------|-------|----------------|
| `https://a.co/x` | 1 | 21² | 3 | 1.44% | 39 | 6 |
| `https://example.com` | 2 | 25² | 5 | 1.39% | 45 | 1,350 |
| `https://github.com/amirzenoozi/qr-maze` | 3 | 29² | 6 | 1.06% | 57 | 8 |

Three to six modules opened, against a budget of dozens. The corridor mostly
threads through light modules that were already there.

### Winning routes

The HUD shows how many ways there are to win. This counts **distinct shortest
routes** — every path that reaches the exit in the minimum number of moves.

Counting *all* simple paths in a grid is combinatorially explosive and not
computable for a board this size. Counting minimum-length routes is exact and
linear: one breadth-first pass to layer the graph by distance, a second pass
pushing route counts forward in that order, so every predecessor's count is
final before it is consumed.

The number swings wildly between URLs (1,350 versus 6 above) because it is
entirely determined by where the QR data happened to leave gaps.

---

## Playing

Enter a URL, wait out the loading screen, and walk.

| Key | Action |
|-----|--------|
| `W` `A` `S` `D` or arrow keys | Move one module |
| `Space` | Open or close the enlarged scan card |
| `C` | Toggle the flat top-down view |
| `R` | Restart the current maze |

- **Start** is the blue pad at the top-left. **Exit** is the chequered flag at
  the bottom-right, under a gold beam tall enough to see over the hedges.
- The **scan card** pinned to the bottom-right corner is live at all times.
  Point a phone at it during play or after winning; it is the carved matrix,
  the same one the build step decoded to prove it works.
- The **top-down view** (`C`) flattens the world to pure black and white so the
  screen itself becomes a scannable code.

### Sharing a maze

Opening the scan card offers two codes:

| Tab | Encodes | Scanning it |
|-----|---------|-------------|
| **Your code** | The URL you typed | Opens that URL |
| **Play link** | `…/qr-maze/#<your URL>` | Opens this game with the same maze |

Both can be saved as a PNG with **Download**, or handed to the system share
sheet with **Share** (which falls back to copying the link on desktop browsers
without `navigator.share`).

The play link is a plain, uncarved code at error-correction level M — nothing
is walked through it, so it spends no damage budget.

#### Why the URL sits in the fragment

A play link has to carry the whole destination, and every character of it
raises the QR version. Three things are dropped rather than encoded:

- **The `?url=` prefix.** The fragment needs no parameter name.
- **The `https://` scheme.** Absent means `https://`, `!` means `http://`,
  `~` means the string had no scheme and is stored verbatim.
- **Percent-escaping of `:` `/` `?` `&` `=`.** These are legal in a fragment.
  `encodeURIComponent` escapes them anyway, and each one costs two extra
  characters.

| URL | Query form | Fragment form |
|-----|-----------|---------------|
| `https://example.com` | 68 chars, v5 | **50 chars, v4** |
| `https://github.com/amirzenoozi/qr-maze` | 91 chars, v6 | **69 chars, v5** |
| `https://shop.example.org/catalog?category=garden&sort=price&page=3` | 129 chars, v8 | **97 chars, v6** |

The fragment also never leaves the browser, so the address of someone's maze
is not written into a server log. Links using the old `?url=` form are still
read, so codes printed before this change keep working.

There is no shorter option without giving something up. A hash or fingerprint
is one-way by construction: turning `a7f3c1` back into a URL needs a table
somewhere, and this app is a static site with nothing behind it. A real
shortener would mean a backend, an API key, and a link that dies when the
service does. The one lever left is the 37-character prefix
`https://amirzenoozi.github.io/qr-maze/`, which a custom domain would cut to
about seven.

The enlarged card renders in the **square** style rather than the rounded one
used by the corner badge: it is the copy people point a camera at, so it stays
as close to a plain code as possible.

---

## Running it locally

Requires Node `^20.19.0 || >=22.12.0` (Vite 8's floor).

```bash
git clone git@github.com:amirzenoozi/qr-maze.git
cd qr-maze
npm install
npm run dev
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check the project, then bundle to `dist/` |
| `npm run preview` | Serve the production bundle |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | oxlint |
| `npm test` | vitest, single run |

> `vite.config.ts` sets `base: '/qr-maze/'` for GitHub Pages. `dev` and
> `preview` honour the same base, so the local URL is
> `http://localhost:5173/qr-maze/`.

---

## Project layout

```
src/
├── lib/
│   ├── qr/
│   │   ├── types.ts        error-correction levels, damage budgets, matrix type
│   │   ├── generate.ts     wraps the qrcode encoder, copies the module buffer
│   │   ├── reserved.ts     mask of modules the carver must never touch
│   │   ├── verify.ts       rasterise a matrix and decode it with jsQR
│   │   ├── render.ts       pure matrix → RGBA renderer with rounded styling
│   │   └── render.test.ts
│   ├── maze/
│   │   ├── types.ts        points, directions, analysis and maze types
│   │   ├── carve.ts        0-1 bucket search; opens the fewest modules possible
│   │   ├── analyze.ts      solvability, shortest length, distinct route count
│   │   ├── build.ts        the five gates and the L→M→Q→H escalation
│   │   ├── layout.ts       grid ↔ world-space conversion
│   │   └── maze.test.ts
│   ├── render/
│   │   ├── pixelTextures.ts  procedural pixel-art textures (grass, wood, bark…)
│   │   └── random.ts         seeded PRNG so scenery never reshuffles
│   └── share.ts            play links, PNG download, system share sheet
│
├── store/gameStore.ts      zustand: maze, player, phase, camera, scan card
├── hooks/useKeyboardControls.ts
│
├── components/
│   ├── StartScreen.tsx     URL entry
│   ├── LoadingScreen.tsx   staged progress bar
│   ├── GameScreen.tsx      the game and its overlays
│   ├── Scene.tsx           the R3F canvas and its lighting rig
│   ├── Walls.tsx           instanced grass-topped hedge blocks
│   ├── Floor.tsx  Fence.tsx  Trees.tsx  Flowers.tsx  Markers.tsx
│   ├── Player.tsx          the sphere and its shadow-casting point light
│   ├── CameraRig.tsx       gameplay follow ↔ top-down scan view
│   ├── Confetti.tsx        instanced win burst
│   ├── WinOverlay.tsx  Hud.tsx  UrlForm.tsx
│   ├── QrCanvas.tsx        shared styled-QR canvas
│   └── ScanBadge.tsx       the corner card, with a FLIP zoom to full size,
│                           the two code tabs and the download/share actions
│
└── types/qrcode-internals.d.ts
```

Everything under `lib/qr/` and `lib/maze/` is pure and DOM-free, which is why
the whole QR pipeline is testable in Node without a headless browser.
`lib/share.ts` is the one exception — it is browser plumbing by definition.

---

## The interesting problems

A few decisions that were not obvious, recorded because the reasoning matters
more than the code.

**Light function modules are walkable.** The timing patterns are a full row and
a full column of alternating cells running through the symbol. An early version
treated every function module as solid, which sliced the board into four
disconnected quadrants and stranded the start at `(7, 9)`. The fix was to
separate *reserved* from *impassable*: a light module is walkable no matter what
it encodes, and only **dark reserved** modules are permanent walls. Routes now
cross at the light cells of a timing pattern or slip along the separator ring
around a finder.

**The start cannot be `(0, 0)`.** That corner is the top-left finder pattern's
dark outer ring, and finders are untouchable. The nearest legal start is
`(0, 7)` or `(7, 0)` — so `row + col == 7` is a provable floor, and the test
suite asserts exactly that.

**There is no fourth finder.** A QR code has three, not four. The bottom-right
corner is ordinary data, which is why it makes a clean exit.

**Carving is minimal, deliberately.** The corridor is found with Dial's
algorithm on a 0/1-weighted graph: stepping onto a light module costs nothing,
stepping onto a dark carvable module costs one. That yields a provably minimal
number of edits. The anchor is then biased toward the top-left corner rather
than toward the cheapest border cell — that spends slightly more budget, but it
threads the corridor across the whole board instead of clipping a corner.

**Scannability is proven, not estimated.** The damage percentage is a heuristic.
The authoritative check is a full decode round-trip through jsQR comparing the
result to the original URL. If it does not decode, the level is rejected.

**Gameplay styling cannot break the code.** The grass, hedges, blossoms, fence
and trees only exist in gameplay mode. The top-down view and the scan card are
separate flat passes over the same verified matrix — pure black on white, with
all decoration unmounted. The fence in particular is hidden in scan mode because
it stands inside the quiet zone, the one region a decoder needs blank.

**Every QR style is decode-tested.** `render.ts` exposes a `QR_STYLES` table.
The test suite iterates it, rendering each preset for each test URL and decoding
the result. Adding a style that does not scan fails CI.

---

## Inspecting a level

There is a CLI for looking at what the pipeline produced:

```bash
npx vite-node scripts/inspect.ts "https://example.com"
```

It prints the chosen level, version, size, carved count, damage ratio,
endpoints, shortest length, route count and reachable area, followed by an
ASCII map:

| Symbol | Meaning |
|--------|---------|
| `S` `E` | start, exit |
| `+` | carved open by the maze builder |
| `#` | wall |
| `.` | walkable path |
| `@` | reserved and dark (permanent wall) |
| `-` | reserved and light (walkable) |

---

## Testing

```bash
npm test
```

The suite covers the parts where being wrong is silent:

- the reserved mask marks finders, both timing lines, alignment patterns, and
  leaves the bottom-right corner free
- the start always lands on the first row or column, at `row + col == 7`
- carving never opens a reserved module, and always produces a solvable maze
- carving is minimal, checked against a hand-built grid with a known answer
- route counting matches `C(10,5) = 252` on an open 6×6 grid
- untouched and carved symbols both decode back to their original URL
- every style preset decodes, at full scale and at 40% scale

---

## Deployment

Pushing a `v*` tag publishes to GitHub Pages:

```bash
npm version patch      # or minor / major
git push --follow-tags
```

`.github/workflows/deploy.yml` runs three chained jobs — `verify` (typecheck,
lint, test), `build`, `deploy` — and ships via the Pages OIDC deployment API
rather than a `gh-pages` branch. Only tags deploy, so the live site always
corresponds to a tag you can check out. `workflow_dispatch` is available for
manual runs.

---

## Tech stack

| | |
|---|---|
| React 19 + TypeScript | strict types throughout |
| @react-three/fiber, @react-three/drei | the 3D scene |
| three.js | instanced meshes for walls, blossoms and confetti |
| zustand | game state |
| qrcode | symbol generation |
| jsQR | decode verification |
| Vite | build and dev server |
| vitest | tests |
| oxlint | linting |

---

## License

No license has been chosen yet, so default copyright applies.

Built by [@amirzenoozi](https://github.com/amirzenoozi).
