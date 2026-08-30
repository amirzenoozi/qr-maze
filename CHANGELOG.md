# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/amirzenoozi/qr-maze/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/amirzenoozi/qr-maze/releases/tag/v1.0.0
