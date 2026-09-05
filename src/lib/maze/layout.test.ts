import { describe, expect, it } from 'vitest';
import { CAMERA_SIDE, SCREEN_STEPS, boardExtent, cellToWorld, floorExtent, scanExtent } from './layout';

/**
 * The controls and the camera are one decision split across two files, and
 * the failure mode is silent: nothing crashes when they disagree, the game
 * simply walks the wrong way. These are the assertions that would have caught
 * the camera facing backwards for eleven releases.
 */
describe('screen steps', () => {
  it('opposes up against down and left against right', () => {
    // Summed rather than negated and compared: negating a zero component
    // yields -0, which is a different value to a strict matcher and would
    // fail for the wrong reason.
    expect(SCREEN_STEPS.up[0] + SCREEN_STEPS.down[0]).toBe(0);
    expect(SCREEN_STEPS.up[1] + SCREEN_STEPS.down[1]).toBe(0);
    expect(SCREEN_STEPS.left[0] + SCREEN_STEPS.right[0]).toBe(0);
    expect(SCREEN_STEPS.left[1] + SCREEN_STEPS.right[1]).toBe(0);
  });

  it('moves exactly one cell along exactly one axis', () => {
    for (const step of Object.values(SCREEN_STEPS)) {
      expect(Math.abs(step[0]) + Math.abs(step[1])).toBe(1);
    }
  });

  it('keeps the vertical keys on rows and the horizontal keys on columns', () => {
    expect(SCREEN_STEPS.up[1]).toBe(0);
    expect(SCREEN_STEPS.down[1]).toBe(0);
    expect(SCREEN_STEPS.left[0]).toBe(0);
    expect(SCREEN_STEPS.right[0]).toBe(0);
  });

  it('walks up the screen towards whatever the camera is looking at', () => {
    // Rows run along +Z. A camera on the negative side of the player looks
    // towards higher rows, so up-screen has to be a higher row too.
    const towardsTheView = -CAMERA_SIDE;
    expect(SCREEN_STEPS.up[0]).toBe(towardsTheView);
  });

  it('points the camera at the exit rather than the ground already covered', () => {
    // The exit is the highest row, so a camera on the +Z side of the player
    // stands between the two and shows the way back.
    expect(CAMERA_SIDE).toBeLessThan(0);
  });
});

describe('board geometry', () => {
  it('centres the symbol on the origin', () => {
    const size = 25;
    const [x, z] = cellToWorld(size, { row: 12, col: 12 });
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });

  it('runs rows along Z and columns along X', () => {
    const size = 25;
    const [originX, originZ] = cellToWorld(size, { row: 0, col: 0 });
    const [rowX, rowZ] = cellToWorld(size, { row: 1, col: 0 });
    const [colX, colZ] = cellToWorld(size, { row: 0, col: 1 });

    expect(rowZ - originZ).toBeCloseTo(1);
    expect(rowX).toBeCloseTo(originX);
    expect(colX - originX).toBeCloseTo(1);
    expect(colZ).toBeCloseTo(originZ);
  });

  it('grows the floor past the board and the scan view past the floor', () => {
    const size = 33;
    expect(floorExtent(size)).toBeGreaterThan(boardExtent(size));
    expect(scanExtent(size)).toBeGreaterThan(floorExtent(size));
  });
});
