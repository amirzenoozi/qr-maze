# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.12.1] - 2026-09-05

### Changed

- The gameplay camera is back where it was, in front of the player looking
  towards the ground already crossed. Turning it around put the exit ahead of
  you on paper and played worse in practice. The controls followed it back, as
  they now derive from the same constant. The beacon over the exit is off
  screen again, so the top-down view remains the way to see it.


## [1.12.0] - 2026-09-05

### Added

- Your body, difficulty and sky are remembered between visits.
- A personal best per board, kept per URL and per tier, shown in the HUD and
  called out on the win panel when you beat it. Equalling a best does not count
  as beating it.
- Walking into a hedge now knocks the body against it and rebounds. A refused
  move was previously indistinguishable from a dropped keypress.
- A CI workflow running the checks on every push and pull request. Deployment
  still only happens on a version tag.
- An all-rights-reserved licence.

### Changed

- The camera now sits behind the player and looks towards the exit. It used to
  stand between the two and look back over ground already crossed, which meant
  the beacon marking the exit — the thing Insane switches off — had never been
  visible in normal play. The keyboard and touch axes turned with it, and both
  are now derived from a single constant so they cannot drift apart again.
- The loading screen holds for about a second instead of five to seven. Carving
  takes well under a fifth of one, so the rest was staging, charged to every
  play and every retry.


## [1.11.0] - 2026-09-04

### Added

- The sky now opens on whichever one matches the visitor's local clock, day
  between 07:00 and 19:00. It is only the starting value: once chosen, the sky
  stays chosen rather than relighting the board as the evening arrives.

### Fixed

- Pixel now rolls the right distance. A cube tips a quarter turn per edge
  length travelled rather than per cell, so at its old size it under-rotated by
  about half and visibly skidded. Its edge is now exactly half a cell, which
  turns it twice per move and lands it flat on a face every time.

## [1.10.0] - 2026-09-04

### Added

- Five more player bodies, taking the roster to nine: Lava, a dark rock with
  molten cracks; Football; Basketball; Pokeball; and Mars. Each wears an
  equirectangular map painted into a 64x32 canvas and magnified with
  nearest-neighbour filtering, matching the world's other textures.
- Round bodies roll through the real arc length for their radius, so a ball
  covering one module turns exactly as far as its circumference says it should.

### Changed

- Insane now allows 5% slack instead of demanding a flawless route. A single
  misread corner on a board with no beacon should not be unrecoverable, and the
  margin is small enough that the route is still the point. Its blurb no longer
  claims a perfect route is required.

## [1.9.0] - 2026-09-04

### Added

- Four player bodies, chosen on the start screen or cycled mid-run with `B`.
  Firefly is the original blue sphere; Ember is a spinning octahedron; Nova is a
  tumbling icosahedron; Pixel is a cube that rolls a quarter turn per move.
- Each body tints and trims the travelling light, which is the only moving light
  on the board and the main light source at night. Ember burns hot and close,
  Nova reaches further and dimmer. The trims are multipliers on the sky's
  lantern, so choosing a body shifts the night without overriding how it is lit.

## [1.8.0] - 2026-09-04

### Added

- A day/night switch for the 3D world, on the `N` key and a HUD button. Only
  the scene changes: the interface panels are already dark, and the top-down
  view and the pinned scan card are unlit passes that ignore lighting, so
  neither sky can affect whether the code scans. Night gives the player's
  point light the job the design always intended for it — under a morning sun
  a lantern is invisible, so it had been dimmed to a glow; after dark it is the
  main light source. The choice is a viewing preference rather than part of a
  run, so restarting, rebuilding and returning to the entry screen all leave it
  alone.

## [1.7.2] - 2026-09-04

### Changed

- Movement is refused while the top-down view is open. The flat view shows the
  whole board and a crosshair pinned to the player, which between them answer
  the question the maze is asking; walking with that up was not playing it. The
  block sits in the store rather than in the input hooks, so keyboard and touch
  cannot drift apart, and the HUD posts a paused notice so a dead keypress does
  not read as a bug.

## [1.7.1] - 2026-09-04

### Changed

- The top-down position markers are now a crosshair through the player rather
  than ticks on the edges. The ticks were the cautious answer — they kept
  everything off the code — but reading them meant tracing two lines by eye
  and meeting in the middle, which is work the marker was supposed to save.
- The crosshair crosses the code at 35% opacity, which a new decode test
  covers directly: the same blend is composited over a rendered symbol and put
  through a real decoder, for four URLs across all four tiers from seven
  positions each. Decoding survives to 60% opacity and first fails at 70%, so
  the setting in use keeps about twice the margin it needs.

## [1.7.0] - 2026-09-01

### Added

- Position markers in the top-down view. Red ticks on the top and left edges
  mark the player's row and column, green ticks on the other two mark the
  exit. They sit in a ring outside the quiet zone rather than on the code: a
  coloured dot on a light module binarises to dark and flips that module, and
  a mark inside the quiet zone eats the margin a scanner needs to lock on.
  The view widens by two modules to make room, so the symbol keeps its full
  four-module quiet zone.

### Fixed

- Replaying a board you just won no longer costs a heart. Charging every
  restart closes the one real loophole — restarting a move before the budget
  runs out — but a solved board has nothing left to dodge, so the charge only
  punished finishing. A win now always offers a replay, even at zero hearts.

## [1.6.0] - 2026-08-31

### Added

- Touch controls. Swipe to move one module on a phone or tablet, dominant axis
  winning so a diagonal flick still resolves to a legal step. Deliberately one
  cell per gesture rather than a drag: the board is a grid of single-module
  corridors and the game only accepts whole-cell moves. The keyboard hints
  hide themselves on a touch device and the swipe hint on a desktop.

### Changed

- Retries moved to the top-right corner, opposite the scan card, leaving the
  numbers alone in the top-left.
- A board's route is now held for as long as the player has hearts on it.
  Leaving for the entry screen and coming back returns the same maze rather
  than a new one, so a layout you have been learning survives the trip. Only
  a board whose hearts are gone is re-rolled.
- Hearts are no longer refilled on returning to the entry screen. They belong
  to a board, and that screen has none; refilling there erased the one signal
  saying the last maze had been used up.

## [1.5.0] - 2026-08-31

### Added

- Re-entering a URL now builds a different maze from it. Nearly every cell in
  this grid is free to cross, so a vast number of routes tie for cheapest and
  the search keeps whichever neighbour arrived first; shuffling the order
  neighbours are tried in picks a different route of the same minimal cost,
  leaving the distances — and therefore the damage to the symbol — untouched.
  The shuffle is seeded from the clock at build time, so nothing is stored to
  remember what has already been played.

### Changed

- Retries moved to the top-left corner, larger and without a panel behind
  them. They are read at a glance rather than parsed, unlike the numbers they
  used to sit among.
- The error-correction level is now probed against one canonical board that no
  variant ever plays. Measuring each variant's own board let a URL sitting on
  the boundary between two levels flip symbol size between plays, moving the
  board size and the move count rather than only the route.
- Absolute move budgets and reachable-cell counts no longer order strictly
  across all four tiers. Each tier is measured on its own corridor now, so a
  widened Easy board can offer a shorter best route than a plugged Hard one.
  The guarantee each tier actually makes — its slack over the shortest route
  on its own board — is unchanged, and Easy remains a superset of Normal.
- A shared play link hands the recipient a different route through the same
  code rather than a replay of the sender's board.

## [1.4.0] - 2026-08-31

### Added

- A row of three pixel hearts in the HUD, counting the retries left on the
  current board. Nothing in the maze can hurt the player, so a life is not
  damage: it is the right to start the board over. The first attempt is free
  and every restart spends a heart — after a loss, after a win, or mid-run
  with `R`. Charging all three closes the loophole of restarting one move
  before the budget expires. When the hearts are gone the outcome panel drops
  its retry button and offers only a new URL, which deals a fresh set.

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

[Unreleased]: https://github.com/amirzenoozi/qr-maze/compare/v1.12.1...HEAD
[1.12.1]: https://github.com/amirzenoozi/qr-maze/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.7.2...v1.8.0
[1.7.2]: https://github.com/amirzenoozi/qr-maze/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/amirzenoozi/qr-maze/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/amirzenoozi/qr-maze/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/amirzenoozi/qr-maze/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/amirzenoozi/qr-maze/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/amirzenoozi/qr-maze/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/amirzenoozi/qr-maze/releases/tag/v1.0.0
