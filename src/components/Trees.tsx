import { useMemo } from 'react';
import { WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { shuffle } from '../lib/random';
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
 * A park plants trees here; other themes stand pylons or cactus. The form is
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
  const variance = landmark.variance ?? 0;

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

  /**
   * A height for each corner, drawn fresh on every load.
   *
   * Three identical plants in three corners read as three copies of one asset.
   * Rather than draw three independent numbers and hope they separate, the
   * range is cut into one band per corner and the bands are dealt out, so two
   * landmarks can never land on the same height while each still moves freely
   * within its own share of the range.
   *
   * This is deliberately not seeded from the maze. The heights are scenery, so
   * a fresh set on every visit costs nothing and rewards coming back.
   */
  const scales = useMemo(() => {
    if (variance <= 0) return centres.map(() => 1);

    const bands = centres.map((_, index) => index);
    shuffle(bands, Math.random);

    const step = (variance * 2) / bands.length;
    return bands.map((band) => 1 - variance + step * (band + Math.random()));
  }, [centres, variance]);

  if (cameraMode === 'scan') return null;

  const armWidth = landmark.armWidth ?? landmark.trunkWidth * 0.5;

  return (
    <group>
      {centres.map(([x, z], index) => (
        // Anchored to the top of the block so a height scale lifts the crown
        // without also lifting the plant off the ground it stands on.
        <group key={index} position={[x, WALL_HEIGHT, z]} scale={[1, scales[index], 1]}>
          <mesh position={[0, landmark.trunkHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry
              args={[landmark.trunkWidth, landmark.trunkHeight, landmark.trunkWidth]}
            />
            <meshStandardMaterial map={bark} roughness={1} />
          </mesh>

          {/* Out from the shaft, then up. Both segments are over-long by one
              thickness so the elbow and the shoulder overlap rather than meet,
              which is what keeps a seam from opening as the plant is scaled. */}
          {landmark.arms?.map((arm, armIndex) => (
            <group key={armIndex}>
              <mesh
                position={[(arm.side * arm.reach) / 2, arm.y, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[arm.reach + armWidth, armWidth, armWidth]} />
                <meshStandardMaterial map={bark} roughness={1} />
              </mesh>
              <mesh
                position={[arm.side * arm.reach, arm.y + arm.rise / 2, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[armWidth, arm.rise + armWidth, armWidth]} />
                <meshStandardMaterial map={bark} roughness={1} />
              </mesh>
            </group>
          ))}

          {landmark.tiers.map((tier) => (
            <mesh
              key={tier.y}
              position={[0, tier.y - WALL_HEIGHT, 0]}
              castShadow
              receiveShadow
            >
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
