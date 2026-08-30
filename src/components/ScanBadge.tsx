import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { generateQrMatrix } from '../lib/qr/generate';
import { QR_STYLES } from '../lib/qr/render';
import type { Maze } from '../lib/maze/types';
import {
  buildPlayLink,
  canvasToFile,
  downloadCanvas,
  qrFileName,
  shareQr,
} from '../lib/share';
import { useGameStore } from '../store/gameStore';
import { QrCanvas } from './QrCanvas';

interface ScanBadgeProps {
  readonly maze: Maze;
  readonly open: boolean;
}

/**
 * Canvas pixels per module, fixed across both sizes so opening the card never
 * re-rasterises: enlarged is near-native, the corner is the same bitmap
 * downscaled.
 */
const MODULE_PX = 16;
const ZOOM_MS = 320;
const ZOOM_EASING = 'cubic-bezier(0.2, 0.85, 0.25, 1)';
const NOTICE_MS = 2600;
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Error correction for the play link. It is never carved, so M costs nothing. */
const PLAY_LEVEL = 'M';

type Tab = 'maze' | 'play';

/**
 * The QR card, pinned bottom-right during play and expanded to the centre of
 * the screen when opened.
 *
 * It is one element in both states rather than a badge plus a dialog, so the
 * open and close transitions can be a FLIP zoom of the same node.
 */
export function ScanBadge({ maze, open }: ScanBadgeProps): React.JSX.Element {
  const toggleScanCard = useGameStore((state) => state.toggleScanCard);
  const closeScanCard = useGameStore((state) => state.closeScanCard);

  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousRect = useRef<DOMRect | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const fileRef = useRef<File | null>(null);

  const [tab, setTab] = useState<Tab>('maze');
  const [notice, setNotice] = useState<string | null>(null);

  const playLink = useMemo(() => buildPlayLink(maze.url), [maze.url]);
  const playMatrix = useMemo(() => {
    try {
      return generateQrMatrix(playLink, PLAY_LEVEL);
    } catch {
      // Only reachable if the link outgrows version 40, which needs a URL of
      // a couple of thousand characters.
      return null;
    }
  }, [playLink]);

  // Falls back to the maze code when the link is too long to encode.
  const showPlay = tab === 'play' && playMatrix !== null;
  const code = showPlay
    ? { modules: playMatrix.modules, size: playMatrix.size, link: playLink, label: 'QR code that opens this maze' }
    : { modules: maze.modules, size: maze.size, link: maze.url, label: `QR code for ${maze.url}` };
  const fileName = qrFileName(maze.url, showPlay ? 'play' : '');

  // FLIP: the card jumps to its new box on the layout that follows a toggle,
  // then this animates the old box back to the new one.
  useLayoutEffect(() => {
    const node = cardRef.current;
    if (node === null) {
      return;
    }

    const next = node.getBoundingClientRect();
    const previous = previousRect.current;
    previousRect.current = next;

    if (previous === null || next.width === 0 || previous.width === 0) {
      return;
    }

    // Scripted animation, so a CSS media query cannot opt out of it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const scale = previous.width / next.width;
    const dx = previous.left - next.left;
    const dy = previous.top - next.top;

    node.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: 'none' }],
      { duration: ZOOM_MS, easing: ZOOM_EASING },
    );
  }, [open]);

  // Modal behaviour while open: focus moves in, Escape and Tab are handled,
  // focus goes back where it came from on close.
  useEffect(() => {
    if (!open) {
      return;
    }

    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cardRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeScanCard();
        return;
      }

      if (event.key !== 'Tab' || cardRef.current === null) {
        return;
      }

      const stops = [...cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (stops.length === 0) {
        return;
      }

      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      opener.current?.focus();
    };
  }, [open, closeScanCard]);

  // Prepared ahead of any click so the share handler never awaits, which would
  // cost the transient user activation that `navigator.share` requires.
  useEffect(() => {
    fileRef.current = null;
    const canvas = canvasRef.current;
    if (!open || canvas === null) {
      return;
    }

    let cancelled = false;
    void canvasToFile(canvas, fileName).then((file) => {
      if (!cancelled) {
        fileRef.current = file;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, fileName, code.modules]);

  useEffect(() => {
    if (notice === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, NOTICE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  const onDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    void downloadCanvas(canvas, fileName).then((saved) => {
      setNotice(saved ? `Saved ${fileName}` : 'Could not save the image');
    });
  }, [fileName]);

  const onShare = useCallback(() => {
    void shareQr({
      title: 'QR Maze',
      text: showPlay ? 'Play this QR maze' : maze.url,
      link: code.link,
      file: fileRef.current,
    }).then((outcome) => {
      if (outcome === 'copied') {
        setNotice('Link copied');
      } else if (outcome === 'unavailable') {
        setNotice('Sharing is not available here');
      }
    });
  }, [showPlay, maze.url, code.link]);

  return (
    <>
      {open && <div className="scan-backdrop" onClick={closeScanCard} aria-hidden="true" />}

      <div
        ref={cardRef}
        className={open ? 'scan-badge scan-badge--open' : 'scan-badge'}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'QR code' : undefined}
      >
        {open && (
          <div className="scan-badge__tabs">
            <button
              className="scan-badge__tab"
              type="button"
              aria-pressed={!showPlay}
              onClick={() => {
                setTab('maze');
              }}
            >
              Your code
            </button>
            <button
              className="scan-badge__tab"
              type="button"
              aria-pressed={showPlay}
              disabled={playMatrix === null}
              onClick={() => {
                setTab('play');
              }}
            >
              Play link
            </button>
          </div>
        )}

        {open ? (
          <QrCanvas
            modules={code.modules}
            size={code.size}
            label={code.label}
            // Square modules in the enlarged view: this is the copy people
            // point a camera at, so it stays as close to a plain code as
            // possible.
            style={QR_STYLES.square}
            modulePx={MODULE_PX}
            canvasRef={canvasRef}
            className="scan-badge__code"
          />
        ) : (
          <button
            className="scan-badge__toggle"
            type="button"
            onClick={toggleScanCard}
            aria-expanded={false}
            aria-label="Enlarge the QR code"
          >
            <QrCanvas
              modules={maze.modules}
              size={maze.size}
              label={`QR code for ${maze.url}`}
              style={QR_STYLES.rounded}
              modulePx={MODULE_PX}
              className="scan-badge__code"
            />
            <span className="scan-badge__caption">Scan me</span>
          </button>
        )}

        {open && (
          <>
            <p className="scan-badge__caption">{code.link}</p>
            <p className="scan-badge__notice" role="status">
              {notice ?? (showPlay ? 'Scanning this opens the game with this maze' : 'Scanning this opens your link')}
            </p>
            <div className="scan-badge__actions">
              <button className="button button--primary" type="button" onClick={onDownload}>
                Download
              </button>
              <button className="button" type="button" onClick={onShare}>
                Share
              </button>
              <button className="button" type="button" onClick={closeScanCard}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
