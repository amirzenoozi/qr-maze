import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useTouchControls } from '../hooks/useTouchControls';
import { useGameStore } from '../store/gameStore';
import { Hud } from './Hud';
import { ScanBadge } from './ScanBadge';
import { Scene } from './Scene';
import { OutcomeOverlay } from './OutcomeOverlay';

/**
 * Third screen: the maze at full bleed, with the HUD, the scannable badge and
 * the win celebration floating on top of it.
 */
export function GameScreen(): React.JSX.Element | null {
  const maze = useGameStore((state) => state.maze);
  const scanCardOpen = useGameStore((state) => state.scanCardOpen);

  // Movement is suspended while the code is enlarged, so the player cannot
  // walk into a wall they cannot see. Space still works: it closes the card.
  useKeyboardControls(!scanCardOpen);
  useTouchControls(!scanCardOpen);

  if (!maze) return null;

  return (
    <div className="screen screen--game">
      <Scene />
      <Hud />
      <OutcomeOverlay />
      <ScanBadge maze={maze} open={scanCardOpen} />
    </div>
  );
}
