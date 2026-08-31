/**
 * One row of chunky pixel hearts, filled from the left.
 *
 * Drawn as SVG rectangles on an 8x7 integer grid rather than as text or an
 * emoji: the rest of the interface is nearest-neighbour pixel art in a bitmap
 * typeface, and a smooth vector heart would be the one anti-aliased curve on
 * screen. Rows 1 to 3 are one rectangle because they span the full width.
 */
const SHAPE: readonly (readonly [number, number, number, number])[] = [
  [1, 0, 2, 1],
  [5, 0, 2, 1],
  [0, 1, 8, 3],
  [1, 4, 6, 1],
  [2, 5, 4, 1],
  [3, 6, 2, 1],
];

interface PixelHeartsProps {
  /** How many hearts to draw. */
  readonly total: number;
  /** How many of them are still lit, counted from the left. */
  readonly left: number;
}

export function PixelHearts({ total, left }: PixelHeartsProps): React.JSX.Element {
  return (
    <span className="hearts" role="img" aria-label={`${left} of ${total} retries left`}>
      {Array.from({ length: total }, (_unused, index) => {
        const spent = index >= left;
        return (
          <svg
            // Keyed on its own state so only the heart that just went out
            // remounts, replaying the extinguish animation exactly once.
            key={`${index}-${spent}`}
            className={spent ? 'heart heart--spent' : 'heart'}
            viewBox="0 0 8 7"
            aria-hidden="true"
          >
            {SHAPE.map(([x, y, width, height]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} />
            ))}
          </svg>
        );
      })}
    </span>
  );
}
