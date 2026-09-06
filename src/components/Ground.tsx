import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { mulberry32 } from '../lib/random';
import { THEME, type ThemeId } from '../lib/render/theme';
import type { CameraMode } from '../store/gameStore';

/**
 * Hard ceiling on decals. A version-40 symbol has thousands of walkable
 * cells; without a cap the clutter would outweigh the path it dresses.
 */
const MAX_DECALS = 3000;

/** Height above the floor, enough to beat z-fighting and nothing more. */
const LIFT = 0.012;

interface GroundProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/**
 * Clutter strewn over the cells the player can walk on.
 *
 * The corridor floor is the busiest part of the frame and until now it was the
 * one surface carrying no detail at all — the scatter only ever landed on wall
 * tops. This fills it.
 *
 * Deliberately flat. A refused move gives almost no feedback beyond the knock,
 * so anything standing up in a one-module corridor would read as a wall the
 * player cannot pass, and the game would be teaching a lie.
 */
export function Ground({ maze, cameraMode, theme }: GroundProps): React.JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const ground = THEME[theme].decor.ground;

  const density = ground?.density ?? 0;
  const size = CELL_SIZE * (ground?.size ?? 0);
  const tints = ground?.tints;

  const decals = useMemo(() => {
    const result: Array<{ x: number; z: number; angle: number; tint: string }> = [];
    // A world that strews nothing stops here, before the single random draw
    // that comes back exactly zero can index an empty palette.
    if (density <= 0 || !tints?.length) return result;

    // Seeded from stable maze identity, so the path does not reshuffle on
    // every re-render. Offset from the scatter's seed, or the stones would
    // land in the same places the wall-top decoration does.
    const random = mulberry32(maze.size * 6151 + maze.carvedCount * 53201 + maze.version);

    for (let row = 0; row < maze.size && result.length < MAX_DECALS; row++) {
      for (let col = 0; col < maze.size && result.length < MAX_DECALS; col++) {
        if (maze.modules[row * maze.size + col] === 1) continue;
        // The two cells that mean something already carry a marker.
        if (row === maze.start.row && col === maze.start.col) continue;
        if (row === maze.end.row && col === maze.end.col) continue;
        if (random() > density) continue;

        const [x, z] = cellToWorld(maze.size, { row, col });
        result.push({
          x: x + (random() - 0.5) * CELL_SIZE * 0.5,
          z: z + (random() - 0.5) * CELL_SIZE * 0.5,
          angle: random() * Math.PI,
          tint: tints[Math.floor(random() * tints.length)],
        });
      }
    }
    return result;
  }, [maze, density, tints]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();

    decals.forEach((decal, i) => {
      matrix.makeRotationY(decal.angle);
      matrix.setPosition(decal.x, LIFT, decal.z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, colour.set(decal.tint));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [decals]);

  if (cameraMode === 'scan' || decals.length === 0) return null;

  return (
    <instancedMesh
      // Instance count is fixed at construction, so remount when it changes.
      key={`${decals.length}-${theme}`}
      ref={meshRef}
      args={[undefined, undefined, decals.length]}
      receiveShadow
    >
      {/* Barely thicker than paint: the whole point is that it cannot be
          mistaken for something blocking the way. */}
      <boxGeometry args={[size, LIFT * 1.6, size]} />
      <meshStandardMaterial roughness={0.95} metalness={0} />
    </instancedMesh>
  );
}
