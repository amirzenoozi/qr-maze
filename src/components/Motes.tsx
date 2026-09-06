// oxlint-disable react/immutability -- Mutating the instance matrix inside
// `useFrame` is the react-three-fiber idiom: the render loop lives outside
// React, so per-frame animation must not go through component state.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { floorExtent } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { mulberry32 } from '../lib/random';
import { THEME, type ThemeId } from '../lib/render/theme';
import type { CameraMode } from '../store/gameStore';

/** Lowest a speck ever sits, so none of them scrape the floor. */
const FLOOR_CLEARANCE = 0.15;

/** Vertical wander, in world units. */
const BOB = 0.12;

interface MotesProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/**
 * Specks drifting across the board: blown sand, falling snow, pollen.
 *
 * Held low deliberately. The gameplay camera's top edge still points below the
 * horizon, so a speck much above two units is outside the frame no matter
 * where the player stands — height here buys nothing and costs instances.
 *
 * They cross the board on the X axis and wrap, which is why the count can stay
 * small: the same two hundred specks pass through shot indefinitely.
 */
export function Motes({ maze, cameraMode, theme }: MotesProps): React.JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const drift = THEME[theme].decor.drift;
  const span = floorExtent(maze.size);

  const specks = useMemo(() => {
    const result: Array<{ x: number; y: number; z: number; phase: number; rate: number }> = [];
    if (!drift || drift.count <= 0) return result;

    // Seeded from the board, so the same maze always blows the same way.
    const random = mulberry32(maze.size * 2081 + maze.version * 34613);

    for (let i = 0; i < drift.count; i++) {
      result.push({
        x: (random() - 0.5) * span,
        y: FLOOR_CLEARANCE + random() * Math.max(0, drift.height - FLOOR_CLEARANCE),
        z: (random() - 0.5) * span,
        phase: random() * Math.PI * 2,
        // A spread of speeds, or the whole field moves as one sheet.
        rate: drift.speed * (0.6 + random() * 0.8),
      });
    }
    return result;
  }, [drift, maze, span]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || specks.length === 0) return;

    const matrix = new THREE.Matrix4();
    const half = span / 2;
    const elapsed = state.clock.elapsedTime;

    specks.forEach((speck, i) => {
      speck.x += speck.rate * delta;
      // Wrap rather than respawn: a speck leaving one edge is the same speck
      // entering the other, so the field never thins out or clumps.
      if (speck.x > half) speck.x -= span;

      matrix.setPosition(
        speck.x,
        speck.y + Math.sin(elapsed + speck.phase) * BOB,
        speck.z,
      );
      mesh.setMatrixAt(i, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!drift || cameraMode === 'scan' || specks.length === 0) return null;

  return (
    <instancedMesh
      // Instance count is fixed at construction, so remount when it changes.
      key={`${specks.length}-${theme}`}
      ref={meshRef}
      args={[undefined, undefined, specks.length]}
      // They roam past wherever the bounding sphere was computed.
      frustumCulled={false}
    >
      <boxGeometry args={[drift.size, drift.size, drift.size]} />
      <meshStandardMaterial
        color={drift.colour}
        transparent
        opacity={0.72}
        roughness={1}
        // A little of its own light, so the specks do not vanish entirely
        // under a night sky — dimmed by it, which is right, but still there.
        emissive={drift.colour}
        emissiveIntensity={0.25}
      />
    </instancedMesh>
  );
}
