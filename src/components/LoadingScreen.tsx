import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

/** Narration for the hold, one line per equal slice of the bar. */
const STAGES = [
  'Encoding the URL…',
  'Reserving finder patterns…',
  'Carving the cheapest corridor…',
  'Counting the winning routes…',
  'Planting hedges and blossoms…',
  'Checking the code still scans…',
] as const;

/** Number of discrete cells in the progress bar. */
const BAR_CELLS = 24;

/**
 * Second screen: the staged wait between submitting a URL and playing.
 *
 * The bar tracks the store's `buildStartedAt` / `buildDuration` rather than
 * real build progress, because the build finishes in milliseconds. Driving it
 * from wall-clock time keeps the animation honest about what it is: a paced
 * reveal, not a fake progress readout that lurches.
 */
export function LoadingScreen(): React.JSX.Element {
  const url = useGameStore((state) => state.url);
  const startedAt = useGameStore((state) => state.buildStartedAt);
  const duration = useGameStore((state) => state.buildDuration);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const tick = (): void => {
      const elapsed = Date.now() - startedAt;
      setProgress(duration <= 0 ? 1 : Math.min(1, elapsed / duration));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, duration]);

  const stageIndex = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));
  const filled = Math.round(progress * BAR_CELLS);

  return (
    <div className="screen screen--loading">
      <div className="panel panel--loading">
        <h2 className="loading__heading">Generating your maze</h2>
        <p className="loading__url">{url}</p>

        <div
          className="bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          {Array.from({ length: BAR_CELLS }, (_, cell) => (
            <span
              key={cell}
              className={cell < filled ? 'bar__cell bar__cell--on' : 'bar__cell'}
            />
          ))}
        </div>

        <p className="loading__stage" role="status">
          {STAGES[stageIndex]}
        </p>
      </div>
    </div>
  );
}
