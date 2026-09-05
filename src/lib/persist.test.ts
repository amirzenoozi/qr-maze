import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadRecords,
  loadSettings,
  recordKey,
  recordSolve,
  saveSettings,
  type Records,
} from './persist';

/**
 * Storage is a browser API and the suite runs in Node, so the tests supply
 * their own. The stub is deliberately faithful about the one behaviour that
 * matters here: `getItem` returns null for an absent key rather than throwing.
 */
class MemoryStorage {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  clear(): void {
    this.entries.clear();
  }
}

const storage = new MemoryStorage();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('settings', () => {
  it('round-trips what the player picked', () => {
    saveSettings({ difficulty: 'insane', skin: 'mars', timeOfDay: 'night' });
    expect(loadSettings()).toEqual({ difficulty: 'insane', skin: 'mars', timeOfDay: 'night' });
  });

  it('reads an empty object when nothing has been saved', () => {
    expect(loadSettings()).toEqual({});
  });

  it('treats unparseable storage as absent rather than throwing', () => {
    storage.setItem('qr-maze:settings', '{not json');
    expect(loadSettings()).toEqual({});
  });

  it('refuses storage that is valid JSON but the wrong shape', () => {
    // An array parses fine and would spread into nonsense downstream.
    storage.setItem('qr-maze:settings', '["insane"]');
    expect(loadSettings()).toEqual({});
  });

  it('survives storage being unavailable entirely', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(() => saveSettings({ skin: 'lava' })).not.toThrow();
    expect(loadSettings()).toEqual({});
  });
});

describe('records', () => {
  const key = recordKey('https://example.com', 'normal');

  it('keys a board by its tier as well as its URL', () => {
    // The tiers do not share a board, so their bests are not comparable.
    expect(recordKey('https://example.com', 'easy')).not.toBe(key);
  });

  it('stores the first solve as the best', () => {
    const next = recordSolve({}, key, 61);
    expect(next[key]).toEqual({ best: 61, solved: 1 });
  });

  it('keeps the lower of two solves and counts both', () => {
    const next = recordSolve(recordSolve({}, key, 61), key, 48);
    expect(next[key]).toEqual({ best: 48, solved: 2 });
  });

  it('does not let a worse run overwrite the best', () => {
    const next = recordSolve(recordSolve({}, key, 48), key, 61);
    expect(next[key]).toEqual({ best: 48, solved: 2 });
  });

  it('persists across a reload', () => {
    recordSolve({}, key, 61);
    expect(loadRecords()[key]).toEqual({ best: 61, solved: 1 });
  });

  it('drops the oldest boards once the table is full', () => {
    let records: Records = {};
    for (let index = 0; index < 205; index += 1) {
      records = recordSolve(records, recordKey(`https://example.com/${index}`, 'normal'), 40);
    }

    expect(Object.keys(records)).toHaveLength(200);
    expect(records[recordKey('https://example.com/0', 'normal')]).toBeUndefined();
    expect(records[recordKey('https://example.com/204', 'normal')]).toBeDefined();
  });

  it('keeps a board alive by re-solving it, since a rewrite does not reorder', () => {
    let records: Records = recordSolve({}, key, 61);
    for (let index = 0; index < 199; index += 1) {
      records = recordSolve(records, recordKey(`https://example.com/${index}`, 'normal'), 40);
    }

    // Exactly at the limit, so nothing has been dropped yet.
    expect(Object.keys(records)).toHaveLength(200);
    expect(records[key]).toBeDefined();
  });
});
