import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';

const numberFormat = new Intl.NumberFormat('en-US');

const TITLE = 'SOLVED!';

/** Milliseconds between letters in the title drop. */
const LETTER_STAGGER_MS = 60;

/**
 * The celebration panel, shown once the player reaches the exit.
 *
 * The wrapper does not take pointer events — only the panel does — so the
 * confetti and the maze behind stay visible and the player can still look
 * around rather than being locked into a full-screen takeover.
 */
export function WinOverlay(): React.JSX.Element | null {
  const { maze, moves, won, restart, returnToStart, openScanCard } = useGameStore(
    useShallow((state) => ({
      maze: state.maze,
      moves: state.moves,
      won: state.won,
      restart: state.restart,
      returnToStart: state.returnToStart,
      openScanCard: state.openScanCard,
    })),
  );

  if (!won || !maze) return null;

  const best = maze.analysis.shortestLength;
  const perfect = best !== null && moves === best;

  return (
    <div className="win">
      <div className="win__panel">
        <p className="win__eyebrow">{perfect ? 'Perfect route' : 'Maze complete'}</p>

        <h2 className="win__title" aria-label={TITLE}>
          {[...TITLE].map((letter, index) => (
            <span
              // The title is a fixed literal, so index is a stable key here.
              key={index}
              className="win__letter"
              style={{ animationDelay: `${index * LETTER_STAGGER_MS}ms` }}
              aria-hidden="true"
            >
              {letter}
            </span>
          ))}
        </h2>

        <p className="win__summary" role="status">
          {perfect
            ? `You walked the shortest route there is — ${numberFormat.format(moves)} moves.`
            : `${numberFormat.format(moves)} moves. The shortest route is ${
                best === null ? '—' : numberFormat.format(best)
              }.`}
        </p>

        <div className="win__actions">
          <button className="button button--primary" type="button" onClick={openScanCard}>
            Scan the code
          </button>
          <button className="button" type="button" onClick={restart}>
            Play again
          </button>
          <button className="button" type="button" onClick={returnToStart}>
            New URL
          </button>
        </div>
      </div>
    </div>
  );
}
