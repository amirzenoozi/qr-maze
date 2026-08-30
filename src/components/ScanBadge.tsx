import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Maze } from '../lib/maze/types';
import { useGameStore } from '../store/gameStore';
import { QrCanvas } from './QrCanvas';

interface ScanBadgeProps {
  readonly maze: Maze;
  readonly open: boolean;
}

/**
 * Canvas pixels per module.
 *
 * Fixed across both sizes so opening the badge never re-rasterises the code:
 * the enlarged state is the canvas at close to its native resolution, and the
 * corner state is the same bitmap smoothly downscaled by the browser.
 */
const MODULE_PX = 16;

/** Milliseconds for the corner <-> centre zoom. */
const ZOOM_MS = 320;

/** Matches the pixel-chrome feel: quick out, soft landing. */
const ZOOM_EASING = 'cubic-bezier(0.2, 0.85, 0.25, 1)';

/**
 * The always-scannable code. It lives in the corner of the game screen and
 * grows to the middle of the screen when opened.
 *
 * There is no second dialog: opening moves *this* element, and a FLIP
 * animation (measure the old box, apply the new layout, then animate the
 * inverse transform away) makes the jump read as a zoom. A separate enlarged
 * copy would have to cross-fade with this one, which looks like two codes
 * rather than one code coming closer.
 */
export function ScanBadge({ maze, open }: ScanBadgeProps): React.JSX.Element {
  const toggleScanCard = useGameStore((state) => state.toggleScanCard);
  const closeScanCard = useGameStore((state) => state.closeScanCard);

  const buttonRef = useRef<HTMLButtonElement>(null);
  /** The element's box as of the previous layout, for the FLIP inversion. */
  const previousRect = useRef<DOMRect | null>(null);
  /** Whatever had focus when the badge was opened, restored on close. */
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = buttonRef.current;
    if (!node) return;

    const next = node.getBoundingClientRect();
    const previous = previousRect.current;
    previousRect.current = next;

    // First layout: there is nothing to animate from.
    if (!previous || previous.width === 0 || next.width === 0) return;

    // A scripted animation, so the reduced-motion query has to be read here
    // rather than left to the stylesheet.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const deltaX = previous.left - next.left;
    const deltaY = previous.top - next.top;
    const scale = previous.width / next.width;

    node.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})` },
        { transform: 'none' },
      ],
      { duration: ZOOM_MS, easing: ZOOM_EASING },
    );
  }, [open]);

  // Focus moves in only while the badge is open: it is a button in the corner
  // the rest of the time, and stealing focus on mount would be rude.
  useEffect(() => {
    if (!open) return;

    opener.current = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeScanCard();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      opener.current?.focus();
      opener.current = null;
    };
  }, [open, closeScanCard]);

  return (
    <>
      {open && (
        <div
          className="scan-backdrop"
          onClick={closeScanCard}
          // The badge itself is the labelled control; this is only a dimmer.
          aria-hidden="true"
        />
      )}

      <button
        ref={buttonRef}
        className={open ? 'scan-badge scan-badge--open' : 'scan-badge'}
        type="button"
        onClick={toggleScanCard}
        aria-expanded={open}
        aria-label={open ? 'Shrink the QR code' : 'Enlarge the QR code'}
      >
        <QrCanvas maze={maze} modulePx={MODULE_PX} className="scan-badge__code" />
        <span className="scan-badge__caption">
          {open ? maze.url : 'Scan me'}
        </span>
      </button>
    </>
  );
}
