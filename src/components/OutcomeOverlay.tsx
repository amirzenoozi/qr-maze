import { useShallow } from 'zustand/react/shallow';
import { DIFFICULTY_CONFIG } from '../lib/maze/difficulty';
import { useGameStore } from '../store/gameStore';

const numberFormat = new Intl.NumberFormat('en-US');

/** Milliseconds between letters in the title drop. */
const LETTER_STAGGER_MS = 60;

/**
 * The end-of-run panel, for either ending.
 *
 * Winning and running out of moves share a shape deliberately: same position,
 * same animation, same first action. Only the wording and the accent change,
 * so a loss reads as the other half of a familiar beat rather than an error
 * state the player has to parse.
 *
 * The wrapper does not take pointer events — only the panel does — so the
 * confetti and the maze behind stay visible and the player can still look
 * around rather than being locked into a full-screen takeover.
 */
export function OutcomeOverlay(): React.JSX.Element | null {
  const { maze, moves, won, lost, lives, restart, returnToStart, openScanCard } = useGameStore(
    useShallow((state) => ({
      maze: state.maze,
      moves: state.moves,
      won: state.won,
      lost: state.lost,
      lives: state.lives,
      restart: state.restart,
      returnToStart: state.returnToStart,
      openScanCard: state.openScanCard,
    })),
  );

  if (!maze || (!won && !lost)) return null;

  const best = maze.analysis.shortestLength;
  const shortest = best === null ? '—' : numberFormat.format(best);
  const perfect = won && best !== null && moves === best;
  // A replay after a win is free, so a solved board always offers one. Only a
  // loss with no hearts left is the end of the road.
  const spent = lives === 0 && !won;

  const title = won ? 'SOLVED!' : spent ? 'GAME OVER' : 'OUT OF MOVES';

  const eyebrow = won
    ? perfect
      ? 'Perfect route'
      : 'Maze complete'
    : `${DIFFICULTY_CONFIG[maze.difficulty].label} — budget spent`;

  const summary = won
    ? perfect
      ? `You walked the shortest route there is — ${numberFormat.format(moves)} moves.`
      : `${numberFormat.format(moves)} moves. The shortest route is ${shortest}.`
    : spent
      ? `All ${numberFormat.format(
          maze.moveBudget,
        )} moves and every retry are gone. The shortest route was ${shortest} — encode another URL for a fresh board.`
      : `You spent all ${numberFormat.format(
          maze.moveBudget,
        )} moves. The shortest route is ${shortest} — the board is the same on a retry, so what you learned still counts.`;

  return (
    <div className="win">
      <div className={won ? 'win__panel' : 'win__panel win__panel--lost'}>
        <p className="win__eyebrow">{eyebrow}</p>

        <h2 className="win__title" aria-label={title}>
          {[...title].map((letter, index) => (
            <span
              // The title is a fixed literal, so index is a stable key here.
              key={index}
              className="win__letter"
              style={{ animationDelay: `${index * LETTER_STAGGER_MS}ms` }}
              aria-hidden="true"
            >
              {letter === ' ' ? '\u00a0' : letter}
            </span>
          ))}
        </h2>

        <p className="win__summary" role="status">
          {summary}
        </p>

        <div className="win__actions">
          {won && (
            <button className="button button--primary" type="button" onClick={openScanCard}>
              Scan the code
            </button>
          )}
          {!spent && (
            <button
              className={won ? 'button' : 'button button--primary'}
              type="button"
              onClick={restart}
            >
              {won ? 'Play again' : 'Try again'}
            </button>
          )}
          <button
            className={spent ? 'button button--primary' : 'button'}
            type="button"
            onClick={returnToStart}
          >
            New URL
          </button>
        </div>
      </div>
    </div>
  );
}
