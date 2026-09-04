import { describe, expect, it } from 'vitest';
import { SKY, timeOfDayAt } from './daylight';

/** Local midday and local midnight, whatever zone the machine is in. */
function at(hour: number): Date {
  const date = new Date(2026, 0, 15, hour, 30, 0);
  return date;
}

describe('timeOfDayAt', () => {
  it('opens on day through the working hours', () => {
    expect(timeOfDayAt(at(7))).toBe('day');
    expect(timeOfDayAt(at(12))).toBe('day');
    expect(timeOfDayAt(at(18))).toBe('day');
  });

  it('opens on night once the evening arrives', () => {
    expect(timeOfDayAt(at(19))).toBe('night');
    expect(timeOfDayAt(at(23))).toBe('night');
    expect(timeOfDayAt(at(0))).toBe('night');
    expect(timeOfDayAt(at(6))).toBe('night');
  });

  it('reads the local clock rather than UTC', () => {
    // Someone at 20:30 gets a night sky whatever their offset from UTC is,
    // which is the whole point of using the visitor's own clock.
    const evening = new Date(2026, 5, 1, 20, 30, 0);
    expect(evening.getHours()).toBe(20);
    expect(timeOfDayAt(evening)).toBe('night');
  });

  it('has a palette for both skies', () => {
    for (const sky of [SKY.day, SKY.night]) {
      expect(sky.background).toMatch(/^#[0-9a-f]{6}$/);
      expect(sky.glow.intensity).toBeGreaterThan(0);
    }
  });
});
