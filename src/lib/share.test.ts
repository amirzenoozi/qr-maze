import { describe, expect, it } from 'vitest';

import { decodeShareBody, encodeShareBody } from './share';

/**
 * The encoding is the one place where a shared link can silently lie: if a
 * body decodes to anything other than the URL that went in, the recipient
 * plays a different maze and scans a code pointing somewhere else.
 */
const URLS = [
  'https://example.com',
  'https://github.com/amirzenoozi/qr-maze',
  'https://shop.example.org/catalog?category=garden&sort=price&page=3',
  'http://insecure.example.com/path',
  'example.com/no-scheme',
  'https://example.com/path with spaces',
  'https://example.com/#fragment',
  'https://example.com/100%25',
  'https://例え.テスト/パス',
  '~starts-with-the-verbatim-marker',
  '!starts-with-the-http-marker',
];

describe('share link encoding', () => {
  it.each(URLS)('round-trips %s', (url) => {
    expect(decodeShareBody(encodeShareBody(url))).toBe(url);
  });

  it('survives a browser normalising the fragment through a URL object', () => {
    for (const url of URLS) {
      const link = new URL(`https://example.test/qr-maze/#${encodeShareBody(url)}`);
      expect(decodeShareBody(link.hash.slice(1))).toBe(url);
    }
  });

  it('drops the https scheme instead of escaping it', () => {
    // encodeURIComponent would turn this into https%3A%2F%2Fexample.com, which
    // is 14 characters where the fragment form needs none.
    expect(encodeShareBody('https://example.com')).toBe('example.com');
  });

  it('keeps path punctuation literal', () => {
    expect(encodeShareBody('https://a.test/b?c=d&e=f')).toBe('a.test/b?c=d&e=f');
  });

  it('is shorter than the query-parameter form it replaced', () => {
    for (const url of URLS) {
      const legacy = `url=${encodeURIComponent(url)}`;
      expect(encodeShareBody(url).length).toBeLessThan(legacy.length);
    }
  });

  it('rejects a fragment that decodes to nothing', () => {
    expect(decodeShareBody('')).toBeNull();
    expect(decodeShareBody('~')).toBeNull();
    expect(decodeShareBody('%E0%A4%A')).toBeNull();
  });
});
