import { useShallow } from 'zustand/react/shallow';
import { recordKey } from '../lib/persist';
import { DIFFICULTY_CONFIG } from '../lib/maze/difficulty';
import { ROUTE_COUNT_CAP } from '../lib/maze/types';
import { LIVES_PER_URL, useGameStore } from '../store/gameStore';
import { PixelHearts } from './PixelHearts';

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
  const {
    maze,
    moves,
    lives,
    records,
    cameraMode,
    timeOfDay,
    toggleTimeOfDay,
    restart,
    returnToStart,
  } =
    useGameStore(
      useShallow((state) => ({
        maze: state.maze,
        moves: state.moves,
        lives: state.lives,
        records: state.records,
        cameraMode: state.cameraMode,
        timeOfDay: state.timeOfDay,
        toggleTimeOfDay: state.toggleTimeOfDay,
        restart: state.restart,
        returnToStart: state.returnToStart,
      })),
    );

  if (!maze) return null;

  const { analysis } = maze;
  const left = Math.max(0, maze.moveBudget - moves);
  const record = records[recordKey(maze.url, maze.difficulty)];
  const routes = analysis.routeCountSaturated
    ? `${numberFormat.format(ROUTE_COUNT_CAP)}+`
    : numberFormat.format(analysis.shortestRouteCount);

  return (
    <>
      <div className="hud__lives">
        <PixelHearts total={LIVES_PER_URL} left={lives} />
      </div>

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
          label="Shortest"
          value={analysis.shortestLength === null ? '—' : `${analysis.shortestLength} moves`}
          hint="Length of a shortest route"
        />
        <Stat
          label="Your best"
          value={record ? `${numberFormat.format(record.best)} moves` : '—'}
          hint={
            record
              ? `Solved ${numberFormat.format(record.solved)} ${
                  record.solved === 1 ? 'time' : 'times'
                } on ${DIFFICULTY_CONFIG[maze.difficulty].label}`
              : 'Not solved yet on this tier'
          }
        />
        <Stat
          label="Winning routes"
          value={routes}
          hint="Distinct shortest paths from start to exit"
        />
      </div>

      <div className="hud__controls">
        {/* Say so, rather than letting a dead keypress read as a bug. */}
        {cameraMode === 'scan' && (
          <p className="hud__paused" role="status">
            Top view — movement paused
          </p>
        )}

        <ul className="hud__hint">
          {/* Shown only where there is a finger to swipe with; the CSS hides
              it on a fine pointer, and hides the key rows on a coarse one. */}
          <li className="hud__hint--touch">Swipe — move one module</li>
          <li className="hud__hint--keys">
            <kbd>WASD</kbd> / arrows — move
          </li>
          <li className="hud__hint--keys">
            <kbd>Space</kbd> — scan code
          </li>
          <li className="hud__hint--keys">
            <kbd>C</kbd> — top view
          </li>
          <li className="hud__hint--keys">
            <kbd>N</kbd> — day / night
          </li>
          <li className="hud__hint--keys">
            <kbd>B</kbd> — change body
          </li>
          <li>
            <kbd>T</kbd> — change world
          </li>
          <li className="hud__hint--keys">
            <kbd>R</kbd> — restart
          </li>
        </ul>

        <div className="hud__actions">
          <button className="button" type="button" onClick={restart} disabled={lives === 0}>
            Restart
          </button>
          {/* Touch players have no keyboard, and this is a preference people
              reach for, so it earns a button as well as the N key. */}
          <button className="button" type="button" onClick={toggleTimeOfDay}>
            {timeOfDay === 'day' ? 'Night' : 'Day'}
          </button>
          <button className="button" type="button" onClick={returnToStart}>
            New URL
          </button>
        </div>
      </div>
    </>
  );
}
