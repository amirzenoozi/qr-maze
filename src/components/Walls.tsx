import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import type { CameraMode } from '../store/gameStore';

/**
 * Above this many wall blocks, per-wall shadow casting is disabled. Point-light
 * shadows render the scene six times (one per cube face), so large symbols
 * would otherwise stall the frame.
 */
const SHADOW_BUDGET = 2500;

interface WallsProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
}

/**
 * Every dark module rendered as a grass-topped hedge block, drawn in a single
 * instanced draw call.
 *
 * A version-40 symbol has ~31k modules, so one mesh per wall is not viable;
 * instancing keeps even the largest symbols to a single draw call. `BoxGeometry`
 * carries one group per face and `InstancedMesh` honours those groups, so a
 * six-entry material array gives the blocks grass on top and hedge on the sides
 * while still instancing.
 */
export function Walls({ maze, cameraMode }: WallsProps): React.JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const scan = cameraMode === 'scan';

  // Positions are derived once per maze, not per frame.
  const positions = useMemo(() => {
    const result: Array<[number, number]> = [];
    for (let row = 0; row < maze.size; row++) {
      for (let col = 0; col < maze.size; col++) {
        if (maze.modules[row * maze.size + col] === 1) {
          result.push(cellToWorld(maze.size, { row, col }));
        }
      }
    }
    return result;
  }, [maze]);

  /**
   * Face order for `BoxGeometry` groups is +X, -X, +Y, -Y, +Z, -Z. In scan
   * mode all six faces become the same unlit black so the top-down view is a
   * genuine high-contrast QR code; foliage there would break the decode.
   */
  const materials = useMemo(() => {
    if (scan) {
      return new THREE.MeshBasicMaterial({ color: '#000000' });
    }

    const { grassTop, hedgeSide } = getPixelTextures();
    const side = new THREE.MeshStandardMaterial({ map: hedgeSide, roughness: 0.95 });
    const top = new THREE.MeshStandardMaterial({ map: grassTop, roughness: 0.9 });
    // The underside is never visible; reusing `side` avoids a seventh program.
    return [side, side, top, side, side, side];
  }, [scan]);

  // Procedurally created materials are owned by this component, so they must
  // be released when the mode changes or the component unmounts.
  useLayoutEffect(() => {
    return () => {
      if (Array.isArray(materials)) {
        new Set(materials).forEach((material) => material.dispose());
      } else {
        materials.dispose();
      }
    };
  }, [materials]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    positions.forEach(([x, z], i) => {
      matrix.setPosition(x, WALL_HEIGHT / 2, z);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, materials]);

  const castShadow = !scan && positions.length <= SHADOW_BUDGET;

  return (
    <instancedMesh
      // Instance count is fixed at construction, so remount when it changes.
      key={`${positions.length}-${scan}`}
      ref={meshRef}
      args={[undefined, undefined, positions.length]}
      material={materials}
      castShadow={castShadow}
      receiveShadow={!scan}
    >
      <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
    </instancedMesh>
  );
}
