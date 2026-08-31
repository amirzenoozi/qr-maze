/**
 * Sharing a maze.
 *
 * Two different codes exist for one game, and conflating them is the easy
 * mistake: the *maze code* is the carved matrix the player is walking through,
 * which resolves to whatever URL they typed. The *play link* is a plain code
 * pointing back at this app with that URL as a query parameter, so scanning it
 * drops someone straight into the same maze.
 */

/** The query parameter carrying the shared URL. */
export const PLAY_PARAM = 'url';

/**
 * Characters a query value keeps verbatim.
 *
 * RFC 3986 allows `pchar / "/" / "?"` in a query, but four of those cannot
 * survive here: `&` and `=` split parameters, `+` decodes as a space, and `%`
 * is the escape marker itself. `#` would end the query, `'` and `;` are
 * escaped by browsers or split by older parsers, so all of them go too.
 *
 * What remains matters because `encodeURIComponent` escapes `:` and `/`, and
 * every escape costs two extra characters in a payload whose length decides
 * the QR version.
 */
const QUERY_SAFE = /[A-Za-z0-9\-._~:/?@!$()*,]/;

/** Marks a payload whose `http://` scheme was stripped. */
const HTTP_MARKER = '!';

/** Marks a payload stored verbatim, because it had no scheme to strip. */
const VERBATIM_MARKER = '~';

/**
 * Pack a URL into the smallest parameter value that still round-trips.
 *
 * Two savings, both aimed at the QR version rather than at looking tidy:
 * `https://` is dropped because it is the overwhelmingly common case, and
 * escaping is limited to the characters that genuinely cannot appear.
 */
export function encodeShareBody(url: string): string {
  let body: string;
  if (url.startsWith('https://')) {
    body = url.slice('https://'.length);
  } else if (url.startsWith('http://')) {
    body = HTTP_MARKER + url.slice('http://'.length);
  } else {
    // No recognised scheme, so nothing can be inferred on the way back.
    body = VERBATIM_MARKER + url;
  }

  let packed = '';
  for (const character of body) {
    packed += QUERY_SAFE.test(character) ? character : encodeURIComponent(character);
  }

  return packed;
}

/** Reverse `encodeShareBody`. Returns null for a body that decodes to nothing. */
export function decodeShareBody(body: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(body);
  } catch {
    // A malformed escape sequence; treat the value as opaque rubbish.
    return null;
  }

  let url: string;
  if (decoded.startsWith(VERBATIM_MARKER)) {
    url = decoded.slice(VERBATIM_MARKER.length);
  } else if (decoded.startsWith(HTTP_MARKER)) {
    url = 'http://' + decoded.slice(HTTP_MARKER.length);
  } else if (decoded.startsWith('https://') || decoded.startsWith('http://')) {
    // Links minted before the scheme was stripped escaped the whole URL, so
    // the scheme is already here. Prepending another would corrupt them.
    url = decoded;
  } else {
    url = 'https://' + decoded;
  }

  const trimmed = url.trim();
  return trimmed === '' || trimmed === 'https://' ? null : trimmed;
}

/**
 * Build the link that reopens this app with `url` already loaded.
 *
 * `import.meta.env.BASE_URL` is `/qr-maze/` in production and `/` under a
 * different deployment, so the link follows the build rather than a hardcoded
 * host.
 *
 * The URL rides in a query parameter. A fragment would be a few characters
 * shorter, but fragments are the part of an address that link handlers,
 * messaging apps and redirects routinely drop, and a play link that loses its
 * payload in transit is worse than a play link one QR version larger.
 *
 * The value is appended rather than set through `URLSearchParams`, which would
 * escape `:` and `/` into six characters apiece.
 */
export function buildPlayLink(url: string): string {
  const link = new URL(import.meta.env.BASE_URL, window.location.origin);
  return `${link.toString()}?${PLAY_PARAM}=${encodeShareBody(url)}`;
}

/**
 * Pull one parameter out of a query string without decoding it.
 *
 * `URLSearchParams` would percent-decode the value, and `decodeShareBody`
 * decodes as well, so a URL containing a literal `%` would be mangled by the
 * second pass.
 */
function rawQueryValue(search: string, name: string): string | null {
  for (const pair of search.replace(/^\?/, '').split('&')) {
    const split = pair.indexOf('=');
    if (split !== -1 && pair.slice(0, split) === name) {
      return pair.slice(split + 1);
    }
  }

  return null;
}

/** Read a preloaded URL out of the current address, if there is one. */
export function readPlayLink(): string | null {
  const parameter = rawQueryValue(window.location.search, PLAY_PARAM);
  if (parameter !== null && parameter !== '') {
    return decodeShareBody(parameter);
  }

  // Links minted while the payload lived in the fragment still work.
  const fragment = window.location.hash.slice(1);
  return fragment === '' ? null : decodeShareBody(fragment);
}

/**
 * Drop the shared URL once it has been consumed.
 *
 * Without this the address bar keeps pointing at someone else's maze, so
 * "New URL" followed by a refresh would silently replay the shared one.
 */
export function clearPlayLink(): void {
  const next = new URL(window.location.href);
  next.hash = '';
  next.searchParams.delete(PLAY_PARAM);
  window.history.replaceState(null, '', next.toString());
}

/** Promise wrapper around the callback-style `canvas.toBlob`. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

/** A filename that says which code this is: `qr-maze-example-com.png`. */
export function qrFileName(url: string, suffix = ''): string {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // Not a parseable URL; fall back to the generic name below.
  }

  const slug = host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const parts = ['qr-maze', slug === '' ? 'code' : slug, suffix].filter((part) => part !== '');
  return `${parts.join('-')}.png`;
}

/** Save the canvas as a PNG through a throwaway anchor. */
export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  const blob = await canvasToBlob(canvas);
  if (blob === null) {
    return false;
  }

  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Revoking in the same tick races the download in some browsers.
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 0);

  return true;
}

/** Turn a canvas into a `File` so it can ride along with a share sheet. */
export async function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File | null> {
  const blob = await canvasToBlob(canvas);
  return blob === null ? null : new File([blob], filename, { type: 'image/png' });
}

export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'unavailable';

export interface SharePayload {
  readonly title: string;
  readonly text: string;
  readonly link: string;
  /**
   * Prepared ahead of the click. Building the blob inside the handler would
   * mean awaiting before `navigator.share`, and Safari drops the transient
   * user activation across an await, refusing the share.
   */
  readonly file: File | null;
}

/**
 * Hand the play link to the platform share sheet, falling back to the
 * clipboard on desktop browsers that have no `navigator.share`.
 */
export async function shareQr({ title, text, link, file }: SharePayload): Promise<ShareOutcome> {
  const data: ShareData = { title, text, url: link };
  if (file !== null && navigator.canShare?.({ files: [file] }) === true) {
    data.files = [file];
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      // Anything else (a permission or a payload the platform rejects) falls
      // through to the clipboard rather than leaving the user with nothing.
    }
  }

  try {
    await navigator.clipboard.writeText(link);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}
