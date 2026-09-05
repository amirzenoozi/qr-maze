import { useLayoutEffect, useMemo } from 'react';
import { floorExtent, scanExtent } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import type { ThemeId } from '../lib/render/theme';
import type { CameraMode } from '../store/gameStore';

interface FloorProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/**
 * The light-module plane the player walks on: a gravel park path.
 *
 * The floor is painted by the theme and is free to be any colour at all.
 * Gameplay is never decoded: the top-down view below swaps to flat white
 * and the pinned card is a separate 2D raster of the matrix, so nothing
 * painted here can eat into the contrast the symbol depends on.
 *
 * In scan mode the plane becomes unlit pure white so that, together with the
 * black wall tops, the top-down view is a genuine high-contrast QR code.
 */
export function Floor({ maze, cameraMode, theme }: FloorProps): React.JSX.Element {
  // Includes the quiet zone, without which a scanner cannot lock on.
  // The top-down view widens the white field by one more ring, so the
  // position markers have somewhere to sit that is not the quiet zone.
  const extent =
    cameraMode === 'scan' ? scanExtent(maze.size) : floorExtent(maze.size);

  // One texture tile per QR module, so the gravel grid lines up with the maze
  // grid instead of drifting across it. `repeat` is per-texture but the pixel
  // data is shared, so this clones the cached texture rather than mutating it.
  const path = useMemo(() => {
    const texture = getPixelTextures(theme).path.clone();
    texture.repeat.set(extent, extent);
    texture.needsUpdate = true;
    return texture;
  }, [extent, theme]);

  // The clone is owned by this component; three.js reference-counts the
  // underlying image source, so disposing it leaves the cached original intact.
  useLayoutEffect(() => () => path.dispose(), [path]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={cameraMode === 'gameplay'}>
      <planeGeometry args={[extent, extent]} />
      {cameraMode === 'scan' ? (
        <meshBasicMaterial color="#ffffff" />
      ) : (
        <meshStandardMaterial map={path} roughness={0.95} metalness={0} />
      )}
    </mesh>
  );
}
