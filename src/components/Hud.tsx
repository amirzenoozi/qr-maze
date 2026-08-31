import { useShallow } from 'zustand/react/shallow';
import { DIFFICULTY_CONFIG } from '../lib/maze/difficulty';
import { ROUTE_COUNT_CAP } from '../lib/maze/types';
import { useGameStore } from '../store/gameStore';

const numberFormat = new Intl.NumberFormat('en-US');

/** Share of the move budget below which the readout starts warning. */
const LOW_BUDGET = 0.25;

interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly urgent?: boolean;
}

function Stat({ label, value, hint, urgent = false }: StatProps): React.JSX.Element {
  return (
    <div className={urgent ? 'stat stat--urgent' : 'stat'} title={hint}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

/**
 * Live readout of the active maze, plus the run controls.
 *
 * The stats sit top-left and the controls bottom-left, so the middle of the
 * screen — where the player actually is — stays clear.
 */
export function Hud(): React.JSX.Element | null {
  const { maze, moves, restart, returnToStart } = useGameStore(
    useShallow((state) => ({
      maze: state.maze,
      moves: state.moves,
      restart: state.restart,
      returnToStart: state.returnToStart,
    })),
  );

  if (!maze) return null;

  const { analysis } = maze;
  const left = Math.max(0, maze.moveBudget - moves);
  const routes = analysis.routeCountSaturated
    ? `${numberFormat.format(ROUTE_COUNT_CAP)}+`
    : numberFormat.format(analysis.shortestRouteCount);

  return (
    <>
      <div className="hud__stats">
        <Stat
          label="Moves left"
          value={numberFormat.format(left)}
          hint={`${numberFormat.format(maze.moveBudget)} allowed on ${
            DIFFICULTY_CONFIG[maze.difficulty].label
          }`}
          urgent={left <= maze.moveBudget * LOW_BUDGET}
        />
        <Stat
          label="Best"
          value={analysis.shortestLength === null ? '—' : `${analysis.shortestLength} moves`}
          hint="Length of a shortest route"
        />
        <Stat
          label="Winning routes"
          value={routes}
          hint="Distinct shortest paths from start to exit"
        />
      </div>

      <div className="hud__controls">
        <ul className="hud__hint">
          <li>
            <kbd>WASD</kbd> / arrows — move
          </li>
          <li>
            <kbd>Space</kbd> — scan code
          </li>
          <li>
            <kbd>C</kbd> — top view
          </li>
          <li>
            <kbd>R</kbd> — restart
          </li>
        </ul>

        <div className="hud__actions">
          <button className="button" type="button" onClick={restart}>
            Restart
          </button>
          <button className="button" type="button" onClick={returnToStart}>
            New URL
          </button>
        </div>
      </div>
    </>
  );
}
