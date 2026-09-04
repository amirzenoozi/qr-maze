import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

/** One grid step per axis, keyed by `KeyboardEvent.code`. */
const MOVE_KEYS: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  KeyW: [-1, 0],
  ArrowDown: [1, 0],
  KeyS: [1, 0],
  ArrowLeft: [0, -1],
  KeyA: [0, -1],
  ArrowRight: [0, 1],
  KeyD: [0, 1],
};

/**
 * Milliseconds between steps while a direction key is held. The browser's own
 * auto-repeat starts too late (~500ms) and its rate is OS-dependent, so held
 * keys are driven from a timer instead.
 */
const REPEAT_INTERVAL_MS = 110;

/**
 * Binds movement, restart, scan-card and camera keys for as long as the
 * component is mounted. Movement is validated by the store, so this hook
 * never needs to know about walls.
 *
 * `enabled` gates movement and restart only. Space stays live even when
 * movement is suspended, because suspension is exactly what the enlarged scan
 * card causes — and Space is how the player dismisses it.
 */
export function useKeyboardControls(enabled: boolean): void {
  useEffect(() => {
    // Insertion-ordered, so the most recently pressed direction wins.
    const held = new Set<string>();
    let timer: number | undefined;

    const step = (): void => {
      const latest = [...held].pop();
      if (latest === undefined) return;
      const [deltaRow, deltaCol] = MOVE_KEYS[latest];
      useGameStore.getState().movePlayer(deltaRow, deltaCol);
    };

    const startRepeating = (): void => {
      if (timer !== undefined) return;
      timer = window.setInterval(step, REPEAT_INTERVAL_MS);
    };

    const stopRepeating = (): void => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };

    const isTypingTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        useGameStore.getState().toggleScanCard();
        return;
      }

      if (!enabled) return;

      if (event.code in MOVE_KEYS) {
        event.preventDefault();
        // Ignore the browser's auto-repeat; the interval owns repetition.
        if (event.repeat) return;
        held.delete(event.code);
        held.add(event.code);
        step();
        startRepeating();
        return;
      }

      if (event.code === 'KeyR') {
        event.preventDefault();
        useGameStore.getState().restart();
        return;
      }

      if (event.code === 'KeyC') {
        event.preventDefault();
        useGameStore.getState().toggleCameraMode();
      }

      if (event.code === 'KeyN') {
        event.preventDefault();
        useGameStore.getState().toggleTimeOfDay();
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (!(event.code in MOVE_KEYS)) return;
      held.delete(event.code);
      if (held.size === 0) stopRepeating();
    };

    // Keys held while the tab loses focus never emit a keyup.
    const onBlur = (): void => {
      held.clear();
      stopRepeating();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      stopRepeating();
    };
  }, [enabled]);
}
