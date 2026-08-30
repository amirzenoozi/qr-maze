import { useLayoutEffect, useRef } from 'react';

import { GameScreen } from './components/GameScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { StartScreen } from './components/StartScreen';
import { clearPlayLinkParam, readPlayLinkParam } from './lib/share';
import { useGameStore } from './store/gameStore';

/**
 * Three screens, selected by build status: URL entry, the staged wait, then
 * the maze. `error` falls back to the entry screen, which is where the message
 * belongs — the user needs the input field to fix it.
 */
export default function App(): React.JSX.Element {
  const status = useGameStore((state) => state.status);
  const shared = useRef(readPlayLinkParam());

  // Layout effect, not a plain one: a shared link should never flash the entry
  // screen before the build starts. Re-entry under StrictMode is harmless —
  // the ref is cleared here, and `buildFromUrl` supersedes its own runs.
  useLayoutEffect(() => {
    const url = shared.current;
    if (url === null) {
      return;
    }

    shared.current = null;
    clearPlayLinkParam();
    useGameStore.getState().buildFromUrl(url);
  }, []);

  // Movement keys are bound by `GameScreen`, which also knows when the scan
  // card should suspend them.

  if (status === 'building') return <LoadingScreen />;
  if (status === 'ready') return <GameScreen />;
  return <StartScreen />;
}
