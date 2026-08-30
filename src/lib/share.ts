/**
 * Sharing a maze.
 *
 * Two different codes exist for one game, and conflating them is the easy
 * mistake: the *maze code* is the carved matrix the player is walking through,
 * which resolves to whatever URL they typed. The *play link* is a plain code
 * pointing back at this app with that URL as a query parameter, so scanning it
 * drops someone straight into the same maze.
 */

/** Query parameter that preloads a maze. */
export const PLAY_PARAM = 'url';

/**
 * Build the link that reopens this app with `url` already loaded.
 *
 * `import.meta.env.BASE_URL` is `/qr-maze/` in production and `/` under a
 * different deployment, so the link follows the build rather than a hardcoded
 * host.
 */
export function buildPlayLink(url: string): string {
  const link = new URL(import.meta.env.BASE_URL, window.location.origin);
  link.searchParams.set(PLAY_PARAM, url);
  return link.toString();
}

/** Read a preloaded URL out of the current address, if there is one. */
export function readPlayLinkParam(): string | null {
  const value = new URLSearchParams(window.location.search).get(PLAY_PARAM);
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Drop the parameter once it has been consumed.
 *
 * Without this the address bar keeps pointing at someone else's maze, so
 * "New URL" followed by a refresh would silently replay the shared one.
 */
export function clearPlayLinkParam(): void {
  const next = new URL(window.location.href);
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
