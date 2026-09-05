import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import { THEME, type ThemeId } from '../lib/render/theme';
import { mulberry32 } from '../lib/random';
import type { CameraMode } from '../store/gameStore';

/** Upper bound on blossoms per flowering block. */
const MAX_PER_BLOCK = 3;

/**
 * Hard ceiling on total blossoms. A version-40 symbol has ~15k dark modules;
 * without a cap the decoration would outweigh the maze it decorates.
 */
const MAX_BLOSSOMS = 4000;


interface FlowersProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/**
 * Wildflowers scattered over the grass tops.
 *
 * Placement is deterministic for a given maze, so the meadow does not
 * reshuffle on re-render. Blossoms are billboard-free crossed quads drawn in
 * one instanced call, and are hidden in scan mode where anything sitting on a
 * module would interfere with the decode.
 */
export function Flowers({
  maze,
  cameraMode,
  theme,
}: FlowersProps): React.JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { blossom } = getPixelTextures(theme);
  const scatter = THEME[theme].decor.scatter;

  const density = scatter.density;
  const size = CELL_SIZE * scatter.size;
  const tints = scatter.tints;

  const blossoms = useMemo(() => {
    // Seeded from stable maze identity, not from render count.
    const random = mulberry32(maze.size * 7919 + maze.carvedCount * 104729 + maze.version);
    const result: Array<{ x: number; y: number; z: number; tint: string }> = [];

    // A world that scatters nothing stops here. Without this, a zero density
    // still admits the one random draw that comes back exactly 0, and the
    // tint lookup would then index an empty palette.
    if (density <= 0 || tints.length === 0) return result;

    for (let row = 0; row < maze.size && result.length < MAX_BLOSSOMS; row++) {
      for (let col = 0; col < maze.size && result.length < MAX_BLOSSOMS; col++) {
        if (maze.modules[row * maze.size + col] !== 1) continue;
        if (random() > density) continue;

        const [x, z] = cellToWorld(maze.size, { row, col });
        const count = 1 + Math.floor(random() * MAX_PER_BLOCK);

        for (let i = 0; i < count; i++) {
          result.push({
            // Inset from the block edge so blossoms do not float over the gap.
            x: x + (random() - 0.5) * CELL_SIZE * 0.6,
            y: WALL_HEIGHT + size * 0.45,
            z: z + (random() - 0.5) * CELL_SIZE * 0.6,
            tint: tints[Math.floor(random() * tints.length)],
          });
        }
      }
    }
    return result;
  }, [maze, density, size, tints]);

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
      key={`${blossoms.length}-${theme}`}
      ref={meshRef}
      args={[undefined, undefined, blossoms.length]}
    >
      {/* A flat box rather than a plane: visible from every angle without
          billboarding, and only 12 triangles per instance. */}
      <boxGeometry args={[size, size * 0.3, size]} />
      <meshStandardMaterial
        map={blossom}
        // The texture is cut out around the petals, so the quad must not paint
        // its transparent corners into the depth buffer.
        transparent
        alphaTest={0.5}
        roughness={0.85}
        // Emissive is driven by the same per-instance tint, so a glowing
        // scatter lights in its own colour rather than a single shared one.
        emissive={scatter.emissive ? '#ffffff' : '#000000'}
        emissiveMap={scatter.emissive ? blossom : null}
        emissiveIntensity={scatter.emissive ? 1.8 : 0}
      />
    </instancedMesh>
  );
}
