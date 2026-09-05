import { useMemo } from 'react';
import { WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import { THEME, type ThemeId } from '../lib/render/theme';
import type { CameraMode } from '../store/gameStore';

/** Finder patterns are 7x7 modules, so their centre sits 3 cells in. */
const FINDER_SIZE = 7;
const FINDER_CENTRE_OFFSET = 3;

/** How much a tapered tier narrows towards its top, as a fraction of width. */
const TAPER = 0.45;

interface TreesProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/**
 * The landmark standing on each of the three finder patterns.
 *
 * A park plants trees here; other themes stand pylons or obelisks. The form is
 * whatever the theme's `decor.landmark` describes, because the useful thing is
 * the position, not the shape: the finders are the only three places on the
 * board guaranteed to be solid, identical and out of play.
 *
 * They are cosmetic only. The finder corners are reserved function patterns
 * that the timing lines cut off from the playable region, so nothing here can
 * affect movement.
 *
 * Landmarks are hidden in scan mode. Seen from above, a crown would cover the
 * finder's dark-light-dark rings, which is precisely the feature a scanner
 * uses to locate and orient the symbol.
 */
export function Trees({ maze, cameraMode, theme }: TreesProps): React.JSX.Element | null {
  const { bark, leaves } = getPixelTextures(theme);
  const landmark = THEME[theme].decor.landmark;

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
          <mesh
            position={[0, WALL_HEIGHT + landmark.trunkHeight / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[landmark.trunkWidth, landmark.trunkHeight, landmark.trunkWidth]}
            />
            <meshStandardMaterial map={bark} roughness={1} />
          </mesh>

          {landmark.tiers.map((tier) => (
            <mesh key={tier.y} position={[0, tier.y, 0]} castShadow receiveShadow>
              {/* A tapered tier is the same box with its top face pulled in,
                  which `BoxGeometry` cannot do; a four-sided cylinder can, and
                  keeps the flat-faceted silhouette the rest of the world has. */}
              {landmark.shape === 'tapered' ? (
                <cylinderGeometry
                  args={[tier.width * TAPER, tier.width, tier.height, 4]}
                />
              ) : (
                <boxGeometry args={[tier.width, tier.height, tier.width]} />
              )}
              <meshStandardMaterial
                map={leaves}
                roughness={0.95}
                emissive={landmark.emissive ?? '#000000'}
                emissiveIntensity={landmark.emissive ? 1.4 : 0}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
