import { useMemo } from 'react';
import { WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import type { CameraMode } from '../store/gameStore';

/** Finder patterns are 7x7 modules, so their centre sits 3 cells in. */
const FINDER_SIZE = 7;
const FINDER_CENTRE_OFFSET = 3;

/**
 * Stacked canopy tiers, widest at the bottom. Widths stay under the 7-module
 * finder so a tree never overhangs a playable corridor.
 */
const CANOPY_TIERS: ReadonlyArray<{ width: number; height: number; y: number }> = [
  { width: 4.4, height: 1.1, y: 3.1 },
  { width: 3.2, height: 1.0, y: 4.0 },
  { width: 1.8, height: 0.9, y: 4.8 },
];

const TRUNK_WIDTH = 0.9;
const TRUNK_HEIGHT = 2.6;

interface TreesProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
}

/**
 * Decorative pixel-art trees planted on the three finder patterns.
 *
 * They are cosmetic only: the finder corners are reserved function patterns
 * that the timing lines cut off from the playable region, so nothing here can
 * affect movement.
 *
 * Trees are hidden in scan mode. Seen from above, a canopy would cover the
 * finder's dark-light-dark rings, which is precisely the feature a scanner
 * uses to locate and orient the symbol.
 */
export function Trees({ maze, cameraMode }: TreesProps): React.JSX.Element | null {
  const { bark, leaves } = getPixelTextures();

  // Top-left, top-right and bottom-left; a QR symbol has no fourth finder.
  const centres = useMemo(() => {
    const far = maze.size - FINDER_SIZE + FINDER_CENTRE_OFFSET;
    const near = FINDER_CENTRE_OFFSET;
    return [
      { row: near, col: near },
      { row: near, col: far },
      { row: far, col: near },
    ].map((cell) => cellToWorld(maze.size, cell));
  }, [maze.size]);

  if (cameraMode === 'scan') return null;

  return (
    <group>
      {centres.map(([x, z], index) => (
        <group key={index} position={[x, 0, z]}>
          <mesh position={[0, WALL_HEIGHT + TRUNK_HEIGHT / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[TRUNK_WIDTH, TRUNK_HEIGHT, TRUNK_WIDTH]} />
            <meshStandardMaterial map={bark} roughness={1} />
          </mesh>

          {CANOPY_TIERS.map((tier) => (
            <mesh key={tier.y} position={[0, tier.y, 0]} castShadow receiveShadow>
              <boxGeometry args={[tier.width, tier.height, tier.width]} />
              <meshStandardMaterial map={leaves} roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
