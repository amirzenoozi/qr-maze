/**
 * The little that survives a reload.
 *
 * Two kinds of thing live here and they are deliberately kept apart. Settings
 * are what the player picked — a body, a tier, a sky — and losing those on
 * every visit is the difference between a toy and something you come back to.
 * Records are what the player earned, keyed by the URL and tier that produced
 * them, because a best of 79 means nothing without knowing which board it was
 * scored on.
 *
 * Every call is wrapped. Storage throws outright in Safari's private mode and
 * under a blocked-cookies policy, and a preference is never worth taking the
 * game down for. A failed read is treated as "no preference yet" and a failed
 * write is dropped in silence.
 */

const SETTINGS_KEY = 'qr-maze:settings';
const RECORDS_KEY = 'qr-maze:records';

/**
 * Cap on remembered boards.
 *
 * Records are keyed per URL and tier, so someone feeding the game links all
 * afternoon would grow this without limit. Oldest entries are dropped first.
 */
const RECORD_LIMIT = 200;

export interface StoredSettings {
  readonly difficulty?: string;
  readonly skin?: string;
  readonly theme?: string;
  readonly timeOfDay?: string;
}

/** Fewest moves a board has ever been solved in, and how often it was solved. */
export interface Record {
  readonly best: number;
  readonly solved: number;
}

export type Records = Readonly<Partial<globalThis.Record<string, Record>>>;

function read<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Anything that is not a plain object is treated as absent rather than
    // repaired. Hand-edited or half-written storage should not crash a boot.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded, storage disabled, private mode. Nothing to do.
  }
}

export function loadSettings(): StoredSettings {
  return read<StoredSettings>(SETTINGS_KEY) ?? {};
}

export function saveSettings(settings: StoredSettings): void {
  write(SETTINGS_KEY, settings);
}

/**
 * Key a record by the board it belongs to.
 *
 * The tier is part of the key because the tiers do not share a board: a
 * different tier bends the corridor and fills squares in, so its best is not
 * comparable. The variant is deliberately *not* part of it — the whole point
 * of a record is that it survives the re-route.
 */
export function recordKey(url: string, difficulty: string): string {
  return `${difficulty}|${url}`;
}

export function loadRecords(): Records {
  return read<Records>(RECORDS_KEY) ?? {};
}

/**
 * Fold a finished run into the record table.
 *
 * Returns the updated table rather than mutating, so a caller can compare and
 * tell whether this run beat the previous best.
 */
export function recordSolve(records: Records, key: string, moves: number): Records {
  const previous = records[key];
  const next: Records = {
    ...records,
    [key]: {
      best: previous ? Math.min(previous.best, moves) : moves,
      solved: (previous?.solved ?? 0) + 1,
    },
  };

  const keys = Object.keys(next);
  if (keys.length <= RECORD_LIMIT) {
    write(RECORDS_KEY, next);
    return next;
  }

  // Object key order is insertion order for string keys, and rewriting an
  // existing key does not move it, so the front of the list is the oldest.
  const trimmed = Object.fromEntries(keys.slice(keys.length - RECORD_LIMIT).map((k) => [k, next[k]]));
  write(RECORDS_KEY, trimmed);
  return trimmed;
}
