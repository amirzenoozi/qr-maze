import { GameScreen } from './components/GameScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { StartScreen } from './components/StartScreen';
import { useGameStore } from './store/gameStore';

/**
 * Three screens, selected by build status: URL entry, the staged wait, then
 * the maze. `error` falls back to the entry screen, which is where the message
 * belongs — the user needs the input field to fix it.
 */
export default function App(): React.JSX.Element {
  const status = useGameStore((state) => state.status);

  // Movement keys are bound by `GameScreen`, which also knows when a dialog
  // should suspend them.

  if (status === 'building') return <LoadingScreen />;
  if (status === 'ready') return <GameScreen />;
  return <StartScreen />;
}
