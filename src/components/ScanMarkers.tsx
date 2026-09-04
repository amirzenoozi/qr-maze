import type { CameraMode } from '../store/gameStore';
import { CELL_SIZE, cellToWorld, scanExtent } from '../lib/maze/layout';
import type { Maze, Point } from '../lib/maze/types';

/**
 * Crosshair appearance.
 *
 * These three numbers are the whole scannability argument, and they are
 * covered by a decode test rather than taken on trust — see
 * `crosshair.test.ts`, which composites exactly this blend over a rendered
 * symbol and puts the result through a real decoder.
 *
 * The lines pass straight over the code, so they must never flip a module. At
 * this opacity a light module lands around 200 of 255 and a dark one around
 * 32: both stay comfortably on their own side of any sane threshold, and the
 * contrast between them is barely dented.
 */
export const CROSSHAIR_COLOUR = '#e03a2f';
export const CROSSHAIR_OPACITY = 0.35;
export const CROSSHAIR_THICKNESS = CELL_SIZE * 0.25;

/** Just clear of the floor, which sits at y = 0. */
const MARKER_Y = 0.02;

interface ScanMarkersProps {
  readonly maze: Maze;
  readonly player: Point;
  readonly cameraMode: CameraMode;
}

/**
 * A crosshair through the player's position in the top-down view.
 *
 * Flattening the board to black and white hides the player, which is the
 * point of the view, but it also leaves you with no idea where you are
 * standing. Two full-length lines solve that at a glance: you read the
 * intersection, not the two edges it came from.
 *
 * They run the full width and height of the white field, so their ends stick
 * out past the code and give the eye something to follow inwards.
 */
export function ScanMarkers({
  maze,
  player,
  cameraMode,
}: ScanMarkersProps): React.JSX.Element | null {
  if (cameraMode !== 'scan') return null;

  const span = scanExtent(maze.size);
  const [playerX, playerZ] = cellToWorld(maze.size, player);

  return (
    <group>
      {/* Along the row. */}
      <mesh position={[0, MARKER_Y, playerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[span, CROSSHAIR_THICKNESS]} />
        <meshBasicMaterial
          color={CROSSHAIR_COLOUR}
          transparent
          opacity={CROSSHAIR_OPACITY}
          depthWrite={false}
        />
      </mesh>

      {/* Along the column. */}
      <mesh position={[playerX, MARKER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CROSSHAIR_THICKNESS, span]} />
        <meshBasicMaterial
          color={CROSSHAIR_COLOUR}
          transparent
          opacity={CROSSHAIR_OPACITY}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
