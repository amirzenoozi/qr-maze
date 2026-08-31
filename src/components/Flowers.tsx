import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import { mulberry32 } from '../lib/random';
import type { CameraMode } from '../store/gameStore';

/** Share of grass blocks that grow at least one blossom. */
const BLOCK_DENSITY = 0.34;

/** Upper bound on blossoms per flowering block. */
const MAX_PER_BLOCK = 3;

/**
 * Hard ceiling on total blossoms. A version-40 symbol has ~15k dark modules;
 * without a cap the decoration would outweigh the maze it decorates.
 */
const MAX_BLOSSOMS = 4000;

const BLOSSOM_SIZE = CELL_SIZE * 0.34;

/** Petal tints, multiplied over the blossom texture per instance. */
const TINTS = ['#ffffff', '#ffd9ec', '#ffe066', '#d9c2ff', '#ff9d9d', '#bfe9ff'];

interface FlowersProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
}

/**
 * Wildflowers scattered over the grass tops.
 *
 * Placement is deterministic for a given maze, so the meadow does not
 * reshuffle on re-render. Blossoms are billboard-free crossed quads drawn in
 * one instanced call, and are hidden in scan mode where anything sitting on a
 * module would interfere with the decode.
 */
export function Flowers({ maze, cameraMode }: FlowersProps): React.JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { blossom } = getPixelTextures();

  const blossoms = useMemo(() => {
    // Seeded from stable maze identity, not from render count.
    const random = mulberry32(maze.size * 7919 + maze.carvedCount * 104729 + maze.version);
    const result: Array<{ x: number; y: number; z: number; tint: string }> = [];

    for (let row = 0; row < maze.size && result.length < MAX_BLOSSOMS; row++) {
      for (let col = 0; col < maze.size && result.length < MAX_BLOSSOMS; col++) {
        if (maze.modules[row * maze.size + col] !== 1) continue;
        if (random() > BLOCK_DENSITY) continue;

        const [x, z] = cellToWorld(maze.size, { row, col });
        const count = 1 + Math.floor(random() * MAX_PER_BLOCK);

        for (let i = 0; i < count; i++) {
          result.push({
            // Inset from the block edge so blossoms do not float over the gap.
            x: x + (random() - 0.5) * CELL_SIZE * 0.6,
            y: WALL_HEIGHT + BLOSSOM_SIZE * 0.45,
            z: z + (random() - 0.5) * CELL_SIZE * 0.6,
            tint: TINTS[Math.floor(random() * TINTS.length)],
          });
        }
      }
    }
    return result;
  }, [maze]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();

    blossoms.forEach((flower, i) => {
      matrix.makeRotationY(0);
      matrix.setPosition(flower.x, flower.y, flower.z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, colour.set(flower.tint));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blossoms]);

  if (cameraMode === 'scan' || blossoms.length === 0) return null;

  return (
    <instancedMesh
      // Instance count is fixed at construction, so remount when it changes.
      key={blossoms.length}
      ref={meshRef}
      args={[undefined, undefined, blossoms.length]}
    >
      {/* A flat box rather than a plane: visible from every angle without
          billboarding, and only 12 triangles per instance. */}
      <boxGeometry args={[BLOSSOM_SIZE, BLOSSOM_SIZE * 0.3, BLOSSOM_SIZE]} />
      <meshStandardMaterial
        map={blossom}
        // The texture is cut out around the petals, so the quad must not paint
        // its transparent corners into the depth buffer.
        transparent
        alphaTest={0.5}
        roughness={0.85}
      />
    </instancedMesh>
  );
}
