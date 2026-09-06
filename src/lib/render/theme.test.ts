import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME, THEMES, type Surface, type ThemeId } from './theme';

/**
 * Every world that exists, including any withheld from the picker. The
 * structural checks run over these rather than over `THEMES`, so a world that
 * is built but not currently offered cannot quietly rot.
 */
const ALL = Object.keys(THEME) as ThemeId[];

/**
 * Finder patterns are 7 modules across and a landmark stands in the middle of
 * one, so anything wider than 7 overhangs a playable corridor.
 */
const FINDER_SIZE = 7;

const HEX = /^#[0-9a-f]{6}$/;

/**
 * Painting needs a canvas and the suite runs in Node, so the tests supply a
 * stub that records nothing and only has to not throw.
 */
function stubCanvas(): void {
  const context = {
    fillStyle: '',
    fillRect: () => {},
    clearRect: () => {},
  };

  (globalThis as Record<string, unknown>).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  };
}

function surfaces(themeId: ThemeId): Surface[] {
  return Object.values(THEME[themeId].surfaces);
}

describe('theme catalogue', () => {
  it('offers each world at most once, with the default among them', () => {
    expect(new Set(THEMES).size).toBe(THEMES.length);
    expect(THEMES).toContain(DEFAULT_THEME);
  });

  it('only offers worlds that exist', () => {
    // The picker may be a subset of the record — a world can be built and
    // withheld — but it can never name one that is not there.
    for (const themeId of THEMES) expect(ALL).toContain(themeId);
  });

  it.each(ALL)('%s gives every surface a usable palette', (themeId) => {
    for (const surface of surfaces(themeId)) {
      // `flat` and `grid` paint from `base[0]` alone, so an empty palette is
      // an exception rather than a blank texture.
      expect(surface.base.length).toBeGreaterThan(0);
      for (const colour of [...surface.base, surface.light, surface.dark]) {
        expect(colour).toMatch(HEX);
      }
    }
  });

  it.each(ALL)('%s paints without throwing', async (themeId) => {
    stubCanvas();
    const { getPixelTextures } = await import('./pixelTextures');

    // Runs every painter the theme names against its real colours. Cheaper
    // than asserting a style list by hand, and it actually executes the code
    // rather than checking a name against a list that can drift from it.
    expect(() => getPixelTextures(themeId)).not.toThrow();
  });

  it.each(ALL)('%s keeps its landmark inside the finder pattern', (themeId) => {
    const { landmark } = THEME[themeId].decor;

    expect(landmark.trunkWidth).toBeGreaterThan(0);
    expect(landmark.trunkWidth).toBeLessThan(FINDER_SIZE);
    expect(landmark.tiers.length).toBeGreaterThan(0);

    for (const tier of landmark.tiers) {
      // A tier wider than the finder would hang over a corridor the player
      // walks, which is the one thing decoration is not allowed to do.
      expect(tier.width).toBeGreaterThan(0);
      expect(tier.width).toBeLessThan(FINDER_SIZE);
      expect(tier.height).toBeGreaterThan(0);
    }
  });

  it.each(ALL)('%s keeps its landmark arms inside the finder', (themeId) => {
    const landmark = THEME[themeId].decor.landmark;
    if (!landmark.arms) return;

    // An arm reaches sideways from the shaft, so the finder's half-width is
    // the budget. Overhang a corridor and the plant covers playable floor.
    const armWidth = landmark.armWidth ?? landmark.trunkWidth * 0.5;
    expect(armWidth).toBeGreaterThan(0);

    for (const arm of landmark.arms) {
      expect(Math.abs(arm.side)).toBe(1);
      expect(arm.y).toBeGreaterThan(0);
      expect(arm.reach).toBeGreaterThan(0);
      expect(arm.rise).toBeGreaterThan(0);
      expect(arm.reach + armWidth / 2).toBeLessThan(FINDER_SIZE / 2);
    }
  });

  it.each(ALL)('%s varies its landmark height by a modest fraction', (themeId) => {
    const { variance } = THEME[themeId].decor.landmark;
    if (variance === undefined) return;

    // Half would let one corner stand twice as tall as another, which stops
    // reading as variation and starts reading as two different plants.
    expect(variance).toBeGreaterThan(0);
    expect(variance).toBeLessThan(0.5);
  });

  it.each(ALL)('%s stacks its landmark tiers upwards', (themeId) => {
    const heights = THEME[themeId].decor.landmark.tiers.map((tier) => tier.y);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
  });

  it.each(ALL)('%s scatters a sane share of the blocks', (themeId) => {
    const { scatter } = THEME[themeId].decor;
    expect(scatter.density).toBeGreaterThanOrEqual(0);
    expect(scatter.density).toBeLessThanOrEqual(1);
    expect(scatter.size).toBeGreaterThan(0);

    // Zero density renders nothing, so an empty tint list is only a problem
    // when something is actually going to be drawn.
    if (scatter.density > 0) expect(scatter.tints.length).toBeGreaterThan(0);
  });

  it.each(ALL)('%s ships both skies', (themeId) => {
    for (const sky of [THEME[themeId].sky.day, THEME[themeId].sky.night]) {
      expect(sky.background).toMatch(HEX);
      expect(sky.glow.intensity).toBeGreaterThan(0);
      expect(sky.sun.position).toHaveLength(3);
    }
  });

  it.each(ALL)('%s marks the exit somehow', (themeId) => {
    const { exit, start } = THEME[themeId].decor;
    // The beam is the only marker visible over a wall, so its colour has to be
    // real even on a theme that flies no flag.
    expect(exit.beamColour).toMatch(HEX);
    expect(exit.padColour).toMatch(HEX);
    expect(start.padColour).toMatch(HEX);
    expect(exit.flagColours).toHaveLength(2);
  });

  it('is legible in a picker', () => {
    for (const themeId of THEMES) {
      expect(THEME[themeId].label.length).toBeGreaterThan(0);
      expect(THEME[themeId].blurb.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The park is what the game rendered before themes existed. These are the
 * values transcribed out of the components, so a refactor that quietly
 * repaints the default world fails here rather than in someone's browser.
 */
/**
 * Underside of the player body: it rests at 1.4 radii and is 1 radius across,
 * so 0.4 * 0.3. Anything taller than this that overhangs a corridor is
 * something the body drives through rather than over.
 */
const PLAYER_UNDERSIDE = 0.12;

/**
 * Height that is still in frame ten units ahead of the player.
 *
 * The gameplay camera sits 9.5 up and 10 back with a 50-degree field of view,
 * so it is pitched 43.5 degrees down and its top edge still points 18.5
 * degrees below horizontal. That is what makes airborne decoration a
 * low-altitude business: put it higher and nobody sees it.
 */
const SIGHT_LINE = 2.8;

/** Texture pixels one module gets at the default tile size. */
const BASE_TILE_PIXELS = 16;

/** Every shape `components/Props` knows how to build. */
const SHAPES = ['snowman', 'husky', 'board'];

/** Every place a prop is allowed to stand. */
const PLACEMENTS = ['outside', 'wall-top'];

describe('ground detail', () => {
  it.each(ALL)('%s banks a drift the body can pass over', (themeId) => {
    const skirt = THEME[themeId].decor.skirt;
    if (!skirt) return;

    expect(skirt.height).toBeGreaterThan(0);
    expect(skirt.spread).toBeGreaterThan(0);
    expect(skirt.colour).toMatch(HEX);

    // A pile confined to its own cell can be any height it likes; one that
    // spills into the corridor has to stay under the body.
    if (skirt.spread > 1) {
      expect(skirt.height).toBeLessThan(PLAYER_UNDERSIDE);
    }
  });

  it.each(ALL)('%s strews the path with flat clutter', (themeId) => {
    const ground = THEME[themeId].decor.ground;
    if (!ground) return;

    expect(ground.density).toBeGreaterThan(0);
    expect(ground.density).toBeLessThanOrEqual(1);
    expect(ground.size).toBeGreaterThan(0);
    expect(ground.tints.length).toBeGreaterThan(0);
    ground.tints.forEach((tint) => expect(tint).toMatch(HEX));
  });

  it.each(ALL)('%s keeps its drifting specks in frame', (themeId) => {
    const drift = THEME[themeId].decor.drift;
    if (!drift) return;

    expect(drift.count).toBeGreaterThan(0);
    expect(drift.size).toBeGreaterThan(0);
    expect(drift.speed).toBeGreaterThan(0);
    expect(drift.colour).toMatch(HEX);
    expect(drift.height).toBeGreaterThan(0);
    expect(drift.height).toBeLessThanOrEqual(SIGHT_LINE);
  });

  it.each(ALL)('%s never varies a wall out of existence', (themeId) => {
    const variation = THEME[themeId].decor.wallVariation;
    if (!variation) return;

    expect(variation.tint).toBeGreaterThanOrEqual(0);
    expect(variation.tint).toBeLessThan(1);
    expect(variation.shrink).toBeGreaterThanOrEqual(0);
    // At 1 a block could shrink to nothing and stop reading as a wall.
    expect(variation.shrink).toBeLessThan(1);
  });

  it.each(ALL)('%s holds pixels per module fixed across a wide floor', (themeId) => {
    const floor = THEME[themeId].surfaces.floor;
    if (!floor.tile) return;

    // Spanning several modules is only a fix for the visible repeat if the
    // canvas grows with it. Without this the sand would simply get coarser.
    expect(floor.resolution).toBe(BASE_TILE_PIXELS * floor.tile);
  });

  it.each(ALL)('%s settles something sensible on its rails', (id) => {
    const railCap = THEME[id].decor.border.railCap;
    if (!railCap) return;

    expect(railCap.colour).toMatch(HEX);
    expect(railCap.height).toBeGreaterThan(0);
    // Taller than the rail it sits on and it stops reading as settled.
    expect(railCap.height).toBeLessThan(0.2);
    expect(railCap.overhang).toBeGreaterThanOrEqual(0);
  });

  it.each(ALL)('%s picks one weather for its specks', (id) => {
    const drift = THEME[id].decor.drift;
    if (!drift) return;

    // Optional, but never anything but a flag: the render loop branches on it.
    if (drift.fall !== undefined) expect(typeof drift.fall).toBe('boolean');
  });

  it('lets the snow fall rather than blow', () => {
    const snow = THEME.snow.decor;

    expect(snow.drift?.fall).toBe(true);
    expect(snow.skirt).toBeDefined();
    expect(snow.ground).toBeDefined();
    expect(snow.wallVariation).toBeDefined();
    expect(snow.border.railCap).toBeDefined();
    expect(snow.landmark.variance).toBeGreaterThan(0);
    // Depth, not dirt: darkening white reads as grime, so the tint stays well
    // under the shrink that carries the effect.
    expect(snow.wallVariation!.tint).toBeLessThan(snow.wallVariation!.shrink);
  });

  it.each(ALL)('%s stands props that fit where it puts them', (id) => {
    const props = THEME[id].decor.props;
    if (!props) return;

    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) {
      expect(SHAPES).toContain(prop.shape);
      expect(PLACEMENTS).toContain(prop.where);
      expect(prop.count).toBeGreaterThan(0);
      // Every prop is a one-off mesh group rather than an instanced batch, so
      // a world that asked for dozens would cost more than all the scenery.
      expect(prop.count).toBeLessThanOrEqual(4);
    }
  });

  it.each(ALL)('%s never asks for more wall-top props than a board can hold', (id) => {
    const props = THEME[id].decor.props;
    if (!props) return;

    const onWalls = props
      .filter((prop) => prop.where === 'wall-top')
      .reduce((total, prop) => total + prop.count, 0);
    // The smallest symbol is 21 modules across with the finder corners spoken
    // for, which still leaves a wide margin over anything this permits.
    expect(onWalls).toBeLessThanOrEqual(8);
  });

  it('gives the snow a snowman, a husky and a lost board', () => {
    const props = THEME.snow.decor.props;
    expect(props).toBeDefined();

    const shapes = props?.map((prop) => prop.shape) ?? [];
    expect(shapes).toContain('snowman');
    expect(shapes).toContain('husky');
    expect(shapes).toContain('board');

    // The snowman goes on a block. On a corridor cell it would be an object
    // the player walks straight through, since only a dark module refuses a
    // move, and something solid-looking that isn't solid teaches the player
    // that nothing on screen means anything.
    const snowman = props?.find((prop) => prop.shape === 'snowman');
    expect(snowman?.where).toBe('wall-top');
  });

  it('dresses the desert with all four', () => {
    const desert = THEME.desert.decor;
    expect(desert.skirt).toBeDefined();
    expect(desert.ground).toBeDefined();
    expect(desert.drift).toBeDefined();
    expect(desert.wallVariation).toBeDefined();
  });

  it('grows the desert landmark rather than standing one', () => {
    const landmark = THEME.desert.decor.landmark;
    expect(landmark.arms?.length).toBeGreaterThan(0);
    expect(landmark.variance).toBeGreaterThan(0);
    // Arms at matching heights read as a candelabra, not as a cactus.
    const heights = landmark.arms?.map((arm) => arm.y) ?? [];
    expect(new Set(heights).size).toBe(heights.length);
  });
});

describe('park is unchanged', () => {
  const park = THEME.park;

  it('is the theme the game opens in', () => {
    expect(DEFAULT_THEME).toBe('park');
    expect(THEMES[0]).toBe('park');
  });

  it('keeps the hedge and gravel palettes', () => {
    expect(park.surfaces.wallTop.base).toEqual([
      '#7cc24a',
      '#7cc24a',
      '#7cc24a',
      '#8ed455',
      '#6cb03e',
      '#9ade63',
    ]);
    expect(park.surfaces.wallSide.base).toEqual([
      '#63ab3c',
      '#63ab3c',
      '#579934',
      '#6fb844',
    ]);
    expect(park.surfaces.wallSide.edge).toBe('#8ed455');
    expect(park.surfaces.floor.base).toEqual([
      '#ebe3c6',
      '#ebe3c6',
      '#ebe3c6',
      '#f2ecd6',
      '#ddd4b2',
      '#f7f2e2',
    ]);
  });

  it('carries none of the added ground detail', () => {
    // The detail slots were added for the desert. Park predates them and has
    // to keep rendering exactly as it always has.
    expect(park.decor.skirt).toBeUndefined();
    expect(park.decor.ground).toBeUndefined();
    expect(park.decor.drift).toBeUndefined();
    expect(park.decor.wallVariation).toBeUndefined();
    expect(park.surfaces.floor.tile).toBeUndefined();
    expect(park.surfaces.floor.resolution).toBeUndefined();
  });

  it('keeps the trees, the fence and the flag', () => {
    expect(park.decor.landmark.trunkWidth).toBe(0.9);
    expect(park.decor.landmark.trunkHeight).toBe(2.6);
    expect(park.decor.landmark.shape).toBe('box');
    expect(park.decor.landmark.arms).toBeUndefined();
    expect(park.decor.landmark.variance).toBeUndefined();
    expect(park.decor.border.railCap).toBeUndefined();
    expect(park.decor.props).toBeUndefined();
    expect(park.decor.landmark.emissive).toBeUndefined();
    expect(park.decor.landmark.tiers).toEqual([
      { width: 4.4, height: 1.1, y: 3.1 },
      { width: 3.2, height: 1.0, y: 4.0 },
      { width: 1.8, height: 0.9, y: 4.8 },
    ]);

    expect(park.decor.border.postHeight).toBe(1.5);
    expect(park.decor.border.railLevels).toEqual([0.52, 1.08]);
    expect(park.decor.border.capped).toBe(true);

    expect(park.decor.exit.flag).toBe(true);
    expect(park.decor.exit.padColour).toBe('#ffc63f');
    expect(park.decor.exit.beamColour).toBe('#ffd76a');
    expect(park.decor.start.padColour).toBe('#3fb6e8');
  });

  it('keeps the meadow', () => {
    expect(park.decor.scatter.density).toBe(0.34);
    expect(park.decor.scatter.size).toBe(0.34);
    expect(park.decor.scatter.emissive).toBe(false);
    expect(park.decor.scatter.tints).toEqual([
      '#ffffff',
      '#ffd9ec',
      '#ffe066',
      '#d9c2ff',
      '#ff9d9d',
      '#bfe9ff',
    ]);
  });

  it('keeps both skies', () => {
    expect(park.sky.day.background).toBe('#9fd8f5');
    expect(park.sky.day.ambient).toEqual({ intensity: 1.15, color: '#dbeeff' });
    expect(park.sky.day.sun.position).toEqual([0.9, 0.7, 0.6]);
    expect(park.sky.day.glow).toEqual({
      intensity: 12,
      distance: 11,
      emissiveIntensity: 2.2,
    });

    expect(park.sky.night.background).toBe('#0b1128');
    expect(park.sky.night.ambient).toEqual({ intensity: 0.22, color: '#5a72ad' });
    expect(park.sky.night.glow).toEqual({
      intensity: 30,
      distance: 16,
      emissiveIntensity: 3.2,
    });
  });
});
