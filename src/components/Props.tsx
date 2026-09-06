import { useMemo } from 'react';
import { CELL_SIZE, WALL_HEIGHT, boardExtent, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { hashString, mulberry32, shuffle } from '../lib/random';
import { THEME, type PropShape, type ThemeId } from '../lib/render/theme';
import type { CameraMode } from '../store/gameStore';

interface PropsProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/** How far past the board an outside prop may stand, in cells. */
const OUTSIDE_NEAR = 2.1;
const OUTSIDE_FAR = 3.5;

/** The finder patterns already carry a landmark each. */
const FINDER_SIZE = 7;

interface Placed {
  readonly shape: PropShape;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly turn: number;
}

/**
 * A snowman: three stacked balls, a carrot and two lumps of coal.
 *
 * The body is barely brighter than the snow it stands on, which on its own
 * would be invisible. What actually reads is the carrot, the coal and the
 * shadow it throws — so those are the parts worth having, and the body is
 * only there to hang them on.
 *
 * Kept to about 1.1 units tall because it stands on a wall block, and the
 * camera has roughly 2.8 units of headroom ten cells ahead. A block already
 * spends one of them, so anything taller loses its head for most of the time
 * it is on screen.
 */
function Snowman(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color="#fdfeff" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <sphereGeometry args={[0.21, 8, 6]} />
        <meshStandardMaterial color="#fdfeff" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.97, 0]} castShadow>
        <sphereGeometry args={[0.15, 8, 6]} />
        <meshStandardMaterial color="#fdfeff" roughness={0.9} flatShading />
      </mesh>
      {/* Carrot. The one warm thing in the whole world. */}
      <mesh position={[0, 0.98, 0.17]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.04, 0.16, 5]} />
        <meshStandardMaterial color="#ff8a3d" roughness={0.7} flatShading />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 1.02, 0.12]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshStandardMaterial color="#1b2434" roughness={0.6} />
        </mesh>
      ))}
      {[0.6, 0.72].map((y) => (
        <mesh key={y} position={[0, y, 0.19]}>
          <boxGeometry args={[0.05, 0.05, 0.04]} />
          <meshStandardMaterial color="#1b2434" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A husky, sat down and facing forward.
 *
 * Built out of boxes rather than anything rounded: at this size and at 45% of
 * the device pixel ratio a smooth model would resolve to the same handful of
 * pixels, and the faceted version at least matches everything else.
 */
function Husky(): React.JSX.Element {
  return (
    <group>
      {/* Haunches and back. */}
      <mesh position={[0, 0.2, -0.06]} castShadow>
        <boxGeometry args={[0.3, 0.4, 0.3]} />
        <meshStandardMaterial color="#5d6f8a" roughness={0.85} flatShading />
      </mesh>
      {/* Chest. */}
      <mesh position={[0, 0.24, 0.14]} castShadow>
        <boxGeometry args={[0.24, 0.34, 0.16]} />
        <meshStandardMaterial color="#eef4ff" roughness={0.85} flatShading />
      </mesh>
      {/* Front legs. */}
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.09, 0.19]} castShadow>
          <boxGeometry args={[0.07, 0.18, 0.09]} />
          <meshStandardMaterial color="#eef4ff" roughness={0.85} flatShading />
        </mesh>
      ))}
      {/* Head. */}
      <mesh position={[0, 0.52, 0.08]} castShadow>
        <boxGeometry args={[0.22, 0.2, 0.22]} />
        <meshStandardMaterial color="#5d6f8a" roughness={0.85} flatShading />
      </mesh>
      {/* Muzzle. */}
      <mesh position={[0, 0.48, 0.22]} castShadow>
        <boxGeometry args={[0.12, 0.11, 0.1]} />
        <meshStandardMaterial color="#eef4ff" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.5, 0.28]}>
        <boxGeometry args={[0.05, 0.04, 0.03]} />
        <meshStandardMaterial color="#1b2434" roughness={0.6} />
      </mesh>
      {/* Ears. */}
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.65, 0.04]} castShadow>
          <boxGeometry args={[0.06, 0.1, 0.04]} />
          <meshStandardMaterial color="#3f4d63" roughness={0.85} flatShading />
        </mesh>
      ))}
      {/* Tail, curled up the way a husky carries it. */}
      <mesh position={[0, 0.3, -0.22]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.26, 0.08]} />
        <meshStandardMaterial color="#eef4ff" roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

/**
 * A snowboard planted nose-down in the drift, leaning over.
 *
 * Deliberately the loudest object in the world. Everything else here is a
 * shade of white, so the one thing that isn't gets to be a landmark.
 */
function Board(): React.JSX.Element {
  return (
    <group rotation={[0, 0, 0.22]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.34, 1.2, 0.05]} />
        <meshStandardMaterial color="#d94a4a" roughness={0.55} flatShading />
      </mesh>
      <mesh position={[0, 0.78, 0.031]}>
        <boxGeometry args={[0.34, 0.16, 0.01]} />
        <meshStandardMaterial color="#f4e7c8" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.42, 0.031]}>
        <boxGeometry args={[0.34, 0.08, 0.01]} />
        <meshStandardMaterial color="#1b2434" roughness={0.55} />
      </mesh>
    </group>
  );
}

const SHAPES: Record<PropShape, () => React.JSX.Element> = {
  snowman: Snowman,
  husky: Husky,
  board: Board,
};

/**
 * The one-off scenery a world stands on its board.
 *
 * Everything here is a single mesh group rather than an instanced batch: there
 * are a handful of them and no two are alike, so instancing would cost more in
 * machinery than it saves in draw calls.
 *
 * Placement is seeded from the maze, not from the clock, so a board always
 * stands the same objects in the same places. Landmark heights re-roll on
 * every load because height is only a look; a prop's position is something a
 * player can navigate by, and scenery that wanders between attempts is
 * scenery nobody can use to orient.
 */
export function Props({ maze, cameraMode, theme }: PropsProps): React.JSX.Element | null {
  const props = THEME[theme].decor.props;

  const placed = useMemo(() => {
    const result: Placed[] = [];
    if (!props?.length) return result;

    const random = mulberry32(hashString(`${maze.url}|${maze.size}|${maze.carvedCount}`));
    const half = boardExtent(maze.size) / 2;

    // Wall blocks are a shared pool, so two shapes never land on one block.
    const blocks: Array<[number, number]> = [];
    for (let row = 0; row < maze.size; row++) {
      for (let col = 0; col < maze.size; col++) {
        if (maze.modules[row * maze.size + col] !== 1) continue;
        const nearRow = row < FINDER_SIZE || row >= maze.size - FINDER_SIZE;
        const nearCol = col < FINDER_SIZE || col >= maze.size - FINDER_SIZE;
        // Leave the finder corners to the landmarks already standing there.
        if (nearRow && nearCol) continue;
        blocks.push(cellToWorld(maze.size, { row, col }));
      }
    }
    shuffle(blocks, random);

    let taken = 0;
    for (const entry of props) {
      for (let n = 0; n < entry.count; n++) {
        const turn = random() * Math.PI * 2;
        if (entry.where === 'wall-top') {
          const block = blocks[taken++];
          if (!block) continue;
          result.push({ shape: entry.shape, x: block[0], y: WALL_HEIGHT, z: block[1], turn });
          continue;
        }
        // Outside: past the fence, on one of the four sides of the quiet zone.
        const side = Math.floor(random() * 4) % 4;
        const out = half + CELL_SIZE * (OUTSIDE_NEAR + random() * (OUTSIDE_FAR - OUTSIDE_NEAR));
        const along = (random() * 2 - 1) * half;
        const x = side === 0 ? along : side === 1 ? out : side === 2 ? along : -out;
        const z = side === 0 ? -out : side === 1 ? along : side === 2 ? out : along;
        result.push({ shape: entry.shape, x, y: 0, z, turn });
      }
    }
    return result;
  }, [maze, props]);

  // The quiet zone has to stay empty and every block has to stay flat black.
  if (cameraMode === 'scan' || placed.length === 0) return null;

  return (
    <group>
      {placed.map((prop, index) => {
        const Shape = SHAPES[prop.shape];
        return (
          <group
            key={`${prop.shape}-${index}`}
            position={[prop.x, prop.y, prop.z]}
            rotation={[0, prop.turn, 0]}
          >
            <Shape />
          </group>
        );
      })}
    </group>
  );
}
