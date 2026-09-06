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

/** Sideways wander while falling, in world units. */
const SWAY = 0.18;

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
 * They wrap rather than respawn, which is why the count can stay small: the
 * same few hundred specks pass through shot indefinitely. Blown specks wrap
 * across X, falling ones wrap from the floor back to the ceiling.
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
    const falling = drift?.fall === true;
    // Keep the wrap span positive even if a theme sets a ceiling on the floor.
    const ceiling = Math.max(drift?.height ?? 0, FLOOR_CLEARANCE + 0.5);

    specks.forEach((speck, i) => {
      let x: number;
      let y: number;

      if (falling) {
        speck.y -= speck.rate * delta;
        // A speck landing is the same speck starting again from the ceiling,
        // so the fall never thins out.
        if (speck.y < FLOOR_CLEARANCE) speck.y += ceiling - FLOOR_CLEARANCE;
        y = speck.y;
        // Sway rather than bob: snow drifts sideways on the way down.
        x = speck.x + Math.sin(elapsed + speck.phase) * SWAY;
      } else {
        speck.x += speck.rate * delta;
        // Wrap rather than respawn: a speck leaving one edge is the same speck
        // entering the other, so the field never thins out or clumps.
        if (speck.x > half) speck.x -= span;
        x = speck.x;
        y = speck.y + Math.sin(elapsed + speck.phase) * BOB;
      }

      matrix.setPosition(x, y, speck.z);
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
