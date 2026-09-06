import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { THEME, type ThemeId } from '../lib/render/theme';
import type { CameraMode } from '../store/gameStore';

interface SkirtProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/**
 * Drift banked against the base of every exposed wall block.
 *
 * Sand piles against anything vertical, and this is the detail that most says
 * "desert" without adding a single object to the corridor. It also sits in the
 * best part of the frame: the gameplay camera is pitched far enough down that
 * its top edge still points below the horizon, so the first couple of units of
 * height are most of what anyone ever sees.
 *
 * Blocks with a wall on all four sides are skipped. Their base is buried
 * inside solid geometry, so a pile there is instances spent on something no
 * camera angle can reach.
 */
export function Skirt({ maze, cameraMode, theme }: SkirtProps): React.JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const skirt = THEME[theme].decor.skirt;

  const positions = useMemo(() => {
    const result: Array<[number, number]> = [];
    if (!skirt) return result;

    const { size, modules } = maze;
    const wall = (row: number, col: number): boolean =>
      // Outside the symbol is open floor: the quiet zone the fence stands in.
      row >= 0 && row < size && col >= 0 && col < size && modules[row * size + col] === 1;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (modules[row * size + col] !== 1) continue;
        const buried =
          wall(row - 1, col) && wall(row + 1, col) && wall(row, col - 1) && wall(row, col + 1);
        if (buried) continue;
        result.push(cellToWorld(size, { row, col }));
      }
    }
    return result;
  }, [maze, skirt]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !skirt) return;

    const matrix = new THREE.Matrix4();
    positions.forEach(([x, z], i) => {
      matrix.setPosition(x, skirt.height / 2, z);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, skirt]);

  if (!skirt || cameraMode === 'scan' || positions.length === 0) return null;

  return (
    <instancedMesh
      // Instance count is fixed at construction, so remount when it changes.
      key={`${positions.length}-${theme}`}
      ref={meshRef}
      args={[undefined, undefined, positions.length]}
      receiveShadow
    >
      {/* Wider than its cell, so the pile spills onto the path the way a real
          drift does. It stays under the player's underside at 0.12 world
          units, so the body passes over it rather than through it. */}
      <boxGeometry args={[CELL_SIZE * skirt.spread, skirt.height, CELL_SIZE * skirt.spread]} />
      <meshStandardMaterial color={skirt.colour} roughness={1} metalness={0} />
    </instancedMesh>
  );
}
