import { describe, expect, it } from 'vitest';

import { decodeShareBody, encodeShareBody } from './share';

/**
 * The encoding is the one place where a shared link can silently lie: if a
 * body decodes to anything other than the URL that went in, the recipient
 * plays a different maze and scans a code pointing somewhere else.
 */
const URLS = [
  'https://example.com',
  'https://example.com/search?q=a+b&n=1',
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

  it('survives a browser normalising the parameter through a URL object', () => {
    for (const url of URLS) {
      const link = new URL(`https://example.test/qr-maze/?url=${encodeShareBody(url)}`);
      expect(decodeShareBody(link.search.slice('?url='.length))).toBe(url);
    }
  });

  it('never emits a character that would break out of the parameter', () => {
    for (const url of URLS) {
      // These would split the pair, decode as a space, or end the query.
      expect(encodeShareBody(url)).not.toMatch(/[&=+#]/);
    }
  });

  it('drops the https scheme instead of escaping it', () => {
    // encodeURIComponent would turn this into https%3A%2F%2Fexample.com, which
    // is 14 characters where this form needs none.
    expect(encodeShareBody('https://example.com')).toBe('example.com');
  });

  it('keeps path punctuation literal', () => {
    expect(encodeShareBody('https://a.test/b?c=d&e=f')).toBe('a.test/b?c%3Dd%26e%3Df');
  });

  it('is shorter than escaping the whole URL', () => {
    for (const url of URLS.filter((candidate) => candidate.startsWith('http'))) {
      expect(encodeShareBody(url).length).toBeLessThan(encodeURIComponent(url).length);
    }
  });

  it('costs at most the one marker character on input it cannot shorten', () => {
    // A scheme-less string has nothing to strip, so it pays for its marker.
    for (const url of URLS) {
      expect(encodeShareBody(url).length).toBeLessThanOrEqual(encodeURIComponent(url).length + 1);
    }
  });

  it('still reads links that escaped the whole URL', () => {
    // The first release put encodeURIComponent(url) straight into ?url=.
    for (const url of URLS.filter((candidate) => candidate.startsWith('http'))) {
      expect(decodeShareBody(encodeURIComponent(url))).toBe(url);
    }
  });

  it('rejects a value that decodes to nothing', () => {
    expect(decodeShareBody('')).toBeNull();
    expect(decodeShareBody('~')).toBeNull();
    expect(decodeShareBody('%E0%A4%A')).toBeNull();
  });
});
