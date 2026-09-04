import type { CameraMode } from '../store/gameStore';
import { CELL_SIZE, MARKER_RING, QUIET_ZONE, boardExtent, cellToWorld } from '../lib/maze/layout';
import type { Maze, Point } from '../lib/maze/types';

/** Chunky enough to see at thumbnail size, small enough not to crowd the code. */
const MARKER_LENGTH = CELL_SIZE * 1.4;
const MARKER_WIDTH = CELL_SIZE * 0.9;

/** Just clear of the floor, which sits at y = 0. */
const MARKER_Y = 0.02;

const PLAYER_COLOUR = '#e03a2f';
const EXIT_COLOUR = '#1b7f3b';

interface ScanMarkersProps {
  readonly maze: Maze;
  readonly player: Point;
  readonly cameraMode: CameraMode;
}

/**
 * Edge ticks marking the player's row and column in the top-down view.
 *
 * Flattening the board to a black-and-white code hides the player, which is
 * the point — but it also means you cannot tell where you are. These are the
 * compromise: they say exactly which row and column you are on without
 * putting anything on the code itself.
 *
 * Nothing is drawn over the symbol or inside its quiet zone. A coloured dot on
 * a light module binarises to dark and flips that module, and a mark inside
 * the quiet zone eats the blank margin a scanner needs to find the finder
 * patterns. Out here, past both, a marker costs the symbol nothing at all.
 */
export function ScanMarkers({ maze, player, cameraMode }: ScanMarkersProps): React.JSX.Element | null {
  if (cameraMode !== 'scan') return null;

  // Centre of the marker ring, measured out from the middle of the board.
  const reach = boardExtent(maze.size) / 2 + (QUIET_ZONE + MARKER_RING / 2) * CELL_SIZE;

  const [playerX, playerZ] = cellToWorld(maze.size, player);
  const [exitX, exitZ] = cellToWorld(maze.size, maze.end);

  return (
    <group>
      {/* Player: a tick above the column and one left of the row. */}
      <mesh position={[playerX, MARKER_Y, -reach]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MARKER_WIDTH, MARKER_LENGTH]} />
        <meshBasicMaterial color={PLAYER_COLOUR} />
      </mesh>
      <mesh position={[-reach, MARKER_Y, playerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MARKER_LENGTH, MARKER_WIDTH]} />
        <meshBasicMaterial color={PLAYER_COLOUR} />
      </mesh>

      {/* Exit: the same pair on the opposite edges, so the top-down view
          still shows which corner you are walking towards. */}
      <mesh position={[exitX, MARKER_Y, reach]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MARKER_WIDTH, MARKER_LENGTH]} />
        <meshBasicMaterial color={EXIT_COLOUR} />
      </mesh>
      <mesh position={[reach, MARKER_Y, exitZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MARKER_LENGTH, MARKER_WIDTH]} />
        <meshBasicMaterial color={EXIT_COLOUR} />
      </mesh>
    </group>
  );
}
