import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME, THEMES, type Surface } from './theme';

/**
 * Finder patterns are 7 modules across and a landmark stands in the middle of
 * one, so anything wider than 7 overhangs a playable corridor.
 */
const FINDER_SIZE = 7;

const STYLES = new Set([
  'speckle',
  'tufted',
  'streaked',
  'grains',
  'clumped',
  'planks',
  'petal',
  'flat',
  'grid',
]);

const HEX = /^#[0-9a-f]{6}$/;

function surfaces(themeId: (typeof THEMES)[number]): Surface[] {
  return Object.values(THEME[themeId].surfaces);
}

describe('theme catalogue', () => {
  it('lists every theme exactly once, with the default among them', () => {
    expect(new Set(THEMES).size).toBe(THEMES.length);
    expect(THEMES).toContain(DEFAULT_THEME);
    expect(Object.keys(THEME).sort()).toEqual([...THEMES].sort());
  });

  it.each(THEMES)('%s names a painter that exists for every surface', (themeId) => {
    for (const surface of surfaces(themeId)) {
      expect(STYLES.has(surface.style)).toBe(true);
      expect(surface.base.length).toBeGreaterThan(0);
      for (const colour of [...surface.base, surface.light, surface.dark]) {
        expect(colour).toMatch(HEX);
      }
    }
  });

  it.each(THEMES)('%s keeps its landmark inside the finder pattern', (themeId) => {
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

  it.each(THEMES)('%s stacks its landmark tiers upwards', (themeId) => {
    const heights = THEME[themeId].decor.landmark.tiers.map((tier) => tier.y);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
  });

  it.each(THEMES)('%s scatters a sane share of the blocks', (themeId) => {
    const { scatter } = THEME[themeId].decor;
    expect(scatter.density).toBeGreaterThanOrEqual(0);
    expect(scatter.density).toBeLessThanOrEqual(1);
    expect(scatter.size).toBeGreaterThan(0);

    // Zero density renders nothing, so an empty tint list is only a problem
    // when something is actually going to be drawn.
    if (scatter.density > 0) expect(scatter.tints.length).toBeGreaterThan(0);
  });

  it.each(THEMES)('%s ships both skies', (themeId) => {
    for (const sky of [THEME[themeId].sky.day, THEME[themeId].sky.night]) {
      expect(sky.background).toMatch(HEX);
      expect(sky.glow.intensity).toBeGreaterThan(0);
      expect(sky.sun.position).toHaveLength(3);
    }
  });

  it.each(THEMES)('%s marks the exit somehow', (themeId) => {
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

  it('keeps the trees, the fence and the flag', () => {
    expect(park.decor.landmark.trunkWidth).toBe(0.9);
    expect(park.decor.landmark.trunkHeight).toBe(2.6);
    expect(park.decor.landmark.shape).toBe('box');
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
