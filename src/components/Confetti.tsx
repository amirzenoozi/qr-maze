// oxlint-disable react/immutability -- Mutating instance matrices inside
// `useFrame` is the react-three-fiber idiom: the render loop lives outside
// React, so per-frame animation must not go through component state.
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { mulberry32 } from '../lib/random';
import type { CameraMode } from '../store/gameStore';

const COUNT = 260;
/** Seconds a single piece spends in the air before it is recycled. */
const LIFE = 2.8;
/** World units per second squared. Tuned by eye, not by physics. */
const GRAVITY = -13;

const PIECE_WIDTH = CELL_SIZE * 0.2;
const PIECE_THICKNESS = CELL_SIZE * 0.05;

const COLOURS = [
  '#ffd54a',
  '#ff8ab8',
  '#7de2ff',
  '#a6e874',
  '#ffffff',
  '#ff9d5c',
  '#c9a8ff',
];

interface Piece {
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  /** Staggers launches so the burst becomes a continuous shower. */
  readonly phase: number;
  readonly axis: THREE.Vector3;
  readonly spin: number;
}

interface ConfettiProps {
  readonly maze: Maze;
  readonly active: boolean;
  readonly cameraMode: CameraMode;
}

/**
 * A confetti shower over the exit, shown while the maze is solved.
 *
 * Every piece is a pure function of elapsed time — launch velocity plus
 * gravity, recycled with a modulo — so there is no per-frame state to keep in
 * sync and the whole shower is one instanced draw call.
 *
 * Hidden in scan mode: confetti raining across the symbol is exactly the kind
 * of foreground clutter that stops a decode.
 */
export function Confetti({
  maze,
  active,
  cameraMode,
}: ConfettiProps): React.JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startRef = useRef<number | null>(null);

  const pieces = useMemo<Piece[]>(() => {
    const random = mulberry32(maze.size * 2654435761 + maze.carvedCount);

    return Array.from({ length: COUNT }, () => {
      // Launch into a wide upward cone so the shower spreads over the exit.
      const angle = random() * Math.PI * 2;
      const speed = 1.5 + random() * 4;

      return {
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 8 + random() * 6,
        phase: random() * LIFE,
        axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
        spin: 4 + random() * 8,
      };
    });
  }, [maze]);

  const [originX, originZ] = cellToWorld(maze.size, maze.end);

  // Per-instance colour is fixed for the life of the mesh.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const colour = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      colour.set(COLOURS[i % COLOURS.length]);
      mesh.setColorAt(i, colour);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // `active` is a dependency because the mesh only exists while it is true:
    // the colours have to be written again each time it remounts.
  }, [pieces, active]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) {
      // Not mounted, so clear the anchor: the next win starts its own burst
      // rather than joining one already in progress.
      startRef.current = null;
      return;
    }

    // Anchor to the first rendered frame so the burst always starts at t=0.
    startRef.current ??= clock.elapsedTime;
    const elapsed = clock.elapsedTime - startRef.current;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < COUNT; i++) {
      const piece = pieces[i];
      const t = (elapsed + piece.phase) % LIFE;

      const y = WALL_HEIGHT + piece.vy * t + 0.5 * GRAVITY * t * t;
      position.set(originX + piece.vx * t, y, originZ + piece.vz * t);
      quaternion.setFromAxisAngle(piece.axis, t * piece.spin);

      // Shrink instead of fading: per-instance opacity would need a custom
      // shader, and at this size the difference is invisible.
      const fade = Math.min(1, (LIFE - t) * 4);
      const s = y < 0.05 ? 0 : fade;
      scale.set(s, s, s);

      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!active || cameraMode === 'scan') return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COUNT]}
      // Pieces move every frame, so a bounding sphere would be stale
      // immediately; skipping the cull is cheaper than recomputing it.
      frustumCulled={false}
    >
      <boxGeometry args={[PIECE_WIDTH, PIECE_WIDTH, PIECE_THICKNESS]} />
      <meshStandardMaterial roughness={0.5} metalness={0.1} />
    </instancedMesh>
  );
}
