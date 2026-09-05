import { useEffect } from 'react';
import { SCREEN_STEPS } from '../lib/maze/layout';
import { useGameStore } from '../store/gameStore';

/**
 * Shortest swipe that counts, in CSS pixels.
 *
 * Low enough that a flick of the thumb registers, high enough that the small
 * drag of a tap on a moving finger does not.
 */
const SWIPE_MIN_PX = 24;

/**
 * Longest a swipe may take. A slow drag is someone steadying their grip on
 * the phone, not a move.
 */
const SWIPE_MAX_MS = 700;

/**
 * Swipe to move, one module per gesture.
 *
 * Deliberately one cell per swipe rather than continuous dragging. The board
 * is a grid of single-module corridors and the store only accepts whole-cell
 * moves, so a drag would have to invent an interpolation the game does not
 * have — and on a maze where one wrong turn costs part of a move budget,
 * committing to exactly the step you asked for beats gliding.
 */
export function useTouchControls(enabled: boolean): void {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let tracking = false;

    const onTouchStart = (event: TouchEvent): void => {
      // Multi-touch is a pinch or a stray palm, not a direction.
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startedAt = event.timeStamp;
      tracking = true;
    };

    const onTouchMove = (event: TouchEvent): void => {
      // Stop the browser reading a swipe over the board as a scroll or a
      // pull-to-refresh. Registered non-passively so this is allowed to work.
      if (tracking && event.cancelable) event.preventDefault();
    };

    if (!enabled) return;

    const onTouchEnd = (event: TouchEvent): void => {
      if (!tracking) return;
      tracking = false;

      const touch = event.changedTouches[0];
      if (!touch) return;
      if (event.timeStamp - startedAt > SWIPE_MAX_MS) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (Math.max(absX, absY) < SWIPE_MIN_PX) return;

      // The dominant axis wins outright, so a diagonal flick still resolves to
      // a single legal move instead of doing nothing. Swipes are read as
      // screen directions, the same as the keys, so both follow the camera.
      const { movePlayer } = useGameStore.getState();
      const [deltaRow, deltaCol] = absX > absY
        ? (deltaX > 0 ? SCREEN_STEPS.right : SCREEN_STEPS.left)
        : (deltaY > 0 ? SCREEN_STEPS.down : SCREEN_STEPS.up);
      movePlayer(deltaRow, deltaCol);
    };

    // Nothing is bound while the scan card is up: swallowing touchmove there
    // would stop the card itself scrolling on a short screen.
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled]);
}
