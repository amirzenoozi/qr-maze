# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-08-31

### Added

- Four difficulty tiers, chosen under the URL box on the start screen. Each one
  reshapes the board rather than only rationing moves: Easy and Normal open
  extra modules to add branches and loops, Hard and Insane fill light modules
  in to prune alternatives, Hard bends the corridor through one far corner and
  Insane through two, and Insane also leaves the exit beacon unlit.
- A move budget, sized as a fraction of the shortest route — Easy +60%, Normal
  +35%, Hard +15%, Insane exactly the perfect route. Spending it without
  reaching the exit ends the run, and the retry keeps the same board so what
  the player learned about the layout still counts.

### Changed

- The error-correction headroom for scattered edits is now **measured** rather
  than estimated. The old percentage-of-modules budget overstated it by roughly
  an order of magnitude, because Reed-Solomon repairs whole eight-module
  codewords and scattered edits hit a fresh codeword each: at level L a real
  decoder tolerated between zero and four of them, against a nominal 7%. The
  builder bisects for the true limit with the decoder itself and spends 60% of
  what it finds, keeping the rest as headroom for a phone camera working at an
  angle in bad light.
- Picking a difficulty never resizes the code. The error-correction level is
  chosen against a tier-independent probe, so every tier of a given link
  produces the same symbol — and because the candidate order is shared, Easy's
  extra openings are a superset of Normal's.
- Structural edits cost one error-correction level for most links, since level
  L has almost no scattered headroom to lend.

## [1.2.2] - 2026-08-31

### Changed

- Play links carry the URL in a `?url=` parameter again. The fragment form
  saved four characters, but on every URL measured that saving landed inside
  the same QR version, so it bought nothing a scanner could see while giving
  up the one part of an address that survives being pasted, redirected and
  forwarded. The compact encoding stays: a typical link is 54 characters
  against the 68 of a plainly escaped one. Fragment links keep working.

## [1.2.1] - 2026-08-31

### Changed

- The start screen opens on a LinkedIn profile rather than `https://example.com`.
  The first maze anyone sees is now a version 4 symbol: 65 moves and 227
  reachable cells against the old default's 45 and 190, so the game reads as a
  maze on first sight instead of a short corridor.
- The GitHub credit sits in the bottom-right corner. At the top it competed
  with the title for the first glance; at the bottom it stays reachable without
  being the second thing you read.

## [1.2.0] - 2026-08-31

### Changed

- Play links now carry the URL in the fragment (`…/qr-maze/#example.com`)
  instead of a query parameter. Dropping the `?url=` prefix, the `https://`
  scheme and the percent-escaping of `:` `/` `?` `&` `=` takes a typical link
  from 68 characters to 50, which is one to two QR versions smaller and
  noticeably easier to scan. Links using the old form are still read.
- The enlarged scan card holds one width across both tabs. It was sized to its
  contents, so switching between codes of different versions resized the card
  and made the tabs appear to move.

## [1.1.0] - 2026-08-30

### Added

- A **play link** for every maze: a second QR code encoding
  `…/qr-maze/?url=<your URL>`, so scanning it opens the game with the same
  maze already built. The app reads that parameter on boot and then strips it,
  so a later refresh does not replay someone else's maze.
- **Download** and **Share** in the enlarged scan card. Download saves a PNG;
  Share hands the code and link to the system share sheet, falling back to
  copying the link where `navigator.share` does not exist.
- A README section covering both codes and when to use each.

### Changed

- The enlarged scan card draws its code in the square style. The rounded style
  stays on the corner badge, where nothing is being scanned at arm's length.
- The keyboard guide lists one binding per line. A single run-on row of keys
  reads as prose and gets skipped.
- The scan card is a dialog when open rather than one large button, so the new
  actions are real controls instead of markup nested inside a button. Clicking
  the code no longer closes the card; the backdrop, `Escape` and the Close
  button do, and `Tab` stays inside the card.
- The start screen links to the author's GitHub profile, and the project now
  has a README.

## [1.0.1] - 2026-08-30

### Fixed

- The first deploy failed because the repository had no Pages site and the
  workflow would not create one. It now enables Pages itself, so a fresh clone
  or fork deploys without anyone changing a setting by hand.
- Moved off actions still targeting Node 20, which the runner forces onto
  Node 24 with a deprecation warning.

## [1.0.0] - 2026-08-30

First release: turn any URL into a 3D maze you can walk through, then scan the
finished code with a phone.

### Added

#### QR generation

- Encode a URL with the `qrcode` package and keep the raw module matrix instead
  of an image, so the maze and the printed code stay the same object.
- Map every function pattern of a symbol — finder patterns and their
  separators, both timing lines, all alignment patterns, the format-information
  strips and the version blocks — into a reserved mask that carving may never
  write to.
- Verify scannability with a real decode round-trip through `jsQR` rather than
  trusting a damage percentage. The raster is built by hand rather than through
  a canvas, so the same check runs in Node and in the browser.
- Style the rendered code with rounded modules and rounded finder eyes. Every
  preset is decode-tested, so a style that stops scanning fails the build.

#### Maze

- Carve a corridor with a node-weighted 0/1 shortest-path search (Dial's
  algorithm). Stepping onto a light module is free, opening a dark module costs
  one, and a dark function module is impassable — so the corridor is the
  cheapest possible one and the symbol's structure is never damaged.
- Anchor the entrance to the top-left corner and the exit to the bottom-right
  one. The entrance lands on the light separator ring beside the top-left
  finder, the closest a module can legally sit to the corner.
- Escalate the error-correction level L → M → Q → H and accept the first level
  whose damage budget covers the carve, whose symbol still decodes to the exact
  input URL, and whose maze is solvable. In practice L is always enough: a
  typical carve costs four to ten modules, around 1% damage against a 7%
  budget.
- Count the distinct shortest routes from entrance to exit with a
  breadth-first layering pass, and report it as the number of ways to win.
  Counts are exact up to a billion, then reported as saturated.

#### Game

- Render the matrix as a pixel-art park: hedge blocks with grass tops,
  a gravel path, blossoms scattered over the hedges, pixel trees standing on
  the three finder patterns and a wooden fence around the board.
- Light the scene as a spring morning, with a low directional sun casting long
  shadows and the player's own point light glowing at ground level.
- Move a glowing low-poly sphere on the module grid with WASD or the arrow
  keys. Collision is resolved on the grid, so the sphere can never clip into a
  hedge; the visible position only smooths toward the committed one.
- Mark the entrance with a blue pad and the exit with a gold pad, a chequered
  flag and a fourteen-unit beam of light visible over the hedges.
- Switch to a flat top-down view with `C`. That view drops every decoration,
  unlights the scene and renders pure black on white, so the screen itself is
  scannable.
- Celebrate a win with an instanced confetti burst and a panel offering the
  code, a rerun of the same maze, or a new URL.

#### Interface

- Walk through three screens: enter a URL, watch the maze being built, then
  play full-screen.
- Keep a scannable copy of the code pinned to a corner of the screen at all
  times. Clicking it — or pressing `Space` — zooms it to the middle of the
  screen with a shared-element transition and back again.
- Show the number of winning routes, the shortest possible run and the current
  move count while playing.

### Notes

- Nothing about the gameplay styling can affect scanning. The top-down view and
  the pinned card are separate flat passes over the same verified matrix.

[Unreleased]: https://github.com/amirzenoozi/qr-maze/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/amirzenoozi/qr-maze/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/amirzenoozi/qr-maze/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/amirzenoozi/qr-maze/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/amirzenoozi/qr-maze/releases/tag/v1.0.0
