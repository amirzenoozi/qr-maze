// oxlint-disable react/immutability -- Animating material opacity inside
// `useFrame` is the react-three-fiber idiom: the render loop lives outside
// React, so a per-frame pulse must not go through component state.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DIFFICULTY_CONFIG } from '../lib/maze/difficulty';
import { CELL_SIZE, WALL_HEIGHT, cellToWorld } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import { THEME, type ThemeId } from '../lib/render/theme';
import type { CameraMode } from '../store/gameStore';

const PAD_SIZE = CELL_SIZE * 0.86;
const PAD_HEIGHT = 0.08;

/** Tall enough to clear the one-unit walls from anywhere on the board. */
const BEAM_HEIGHT = 14;
const BEAM_WIDTH = CELL_SIZE * 0.55;

const POLE_HEIGHT = 2.6;
const FLAG_WIDTH = CELL_SIZE * 0.8;
const FLAG_HEIGHT = CELL_SIZE * 0.5;

const PULSE_SPEED = 2.2;

interface MarkersProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
  readonly theme: ThemeId;
}

/**
 * Start and exit markers.
 *
 * Without these the maze gives the player no goal: the exit is a corner cell
 * that looks exactly like every other floor square. The exit therefore gets a
 * light beam tall enough to be seen over the walls from anywhere on the
 * board, which is what makes the objective legible at a glance.
 *
 * Colours and the flag come from the theme. The geometry does not: the pad
 * size, pole and beam height are what make the exit readable at this scale,
 * and a theme that shrank them would be trading legibility for decoration.
 *
 * Both markers are hidden in scan mode, where they would sit on light modules
 * and darken them.
 */
export function Markers({
  maze,
  cameraMode,
  theme,
}: MarkersProps): React.JSX.Element | null {
  const beamRef = useRef<THREE.Mesh>(null);
  const { checker } = getPixelTextures(theme);
  const { exit, start } = THEME[theme].decor;

  useFrame(({ clock }) => {
    const beam = beamRef.current;
    if (!beam) return;

    // Slow breathing pulse; draws the eye without strobing.
    const material = beam.material as THREE.MeshBasicMaterial;
    material.opacity = 0.22 + 0.12 * Math.sin(clock.elapsedTime * PULSE_SPEED);
  });

  const beacon = DIFFICULTY_CONFIG[maze.difficulty].beacon;

  if (cameraMode === 'scan') return null;

  const [startX, startZ] = cellToWorld(maze.size, maze.start);
  const [endX, endZ] = cellToWorld(maze.size, maze.end);

  return (
    <group>
      {/* Start: a flat pad, since the player is standing on it at turn zero
          and a beam here would compete with the exit for attention. */}
      <mesh position={[startX, PAD_HEIGHT / 2, startZ]} receiveShadow>
        <boxGeometry args={[PAD_SIZE, PAD_HEIGHT, PAD_SIZE]} />
        <meshStandardMaterial
          color={start.padColour}
          emissive={start.padEmissive}
          emissiveIntensity={0.6}
          roughness={0.6}
        />
      </mesh>

      <group position={[endX, 0, endZ]}>
        <mesh position={[0, PAD_HEIGHT / 2, 0]} receiveShadow>
          <boxGeometry args={[PAD_SIZE, PAD_HEIGHT, PAD_SIZE]} />
          <meshStandardMaterial
            color={exit.padColour}
            emissive={exit.padEmissive}
            emissiveIntensity={0.8}
            roughness={0.55}
          />
        </mesh>

        <mesh position={[0, WALL_HEIGHT + POLE_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.12, POLE_HEIGHT, 0.12]} />
          <meshStandardMaterial color={exit.poleColour} roughness={1} />
        </mesh>

        {/* A chequered pennant is a race-day object, so a theme that is not
            holding a race flies nothing and keeps the bare pole.

            Except when the beacon is off. Insane trades the beam for the flag,
            so a theme dropping the flag as well would leave the exit marked by
            nothing but a pad you cannot see over a wall. Wayfinding outranks
            decoration: the flag comes back. */}
        {(exit.flag || !beacon) && (
          <mesh
            position={[FLAG_WIDTH / 2, WALL_HEIGHT + POLE_HEIGHT - FLAG_HEIGHT * 0.7, 0]}
            castShadow
          >
            <boxGeometry args={[FLAG_WIDTH, FLAG_HEIGHT, 0.06]} />
            <meshStandardMaterial map={checker} roughness={0.9} />
          </mesh>
        )}

        {/* The beam is the only part of the exit visible over a wall, so
            withholding it is the single biggest change to how lost the player
            feels. Insane trades it for the flag alone, which you have to be
            almost on top of to see. */}
        {beacon && (
          <mesh ref={beamRef} position={[0, BEAM_HEIGHT / 2, 0]}>
            <boxGeometry args={[BEAM_WIDTH, BEAM_HEIGHT, BEAM_WIDTH]} />
            <meshBasicMaterial
              color={exit.beamColour}
              transparent
              opacity={0.25}
              // Additive and depth-write-free so the beam glows over the scene
              // instead of punching a hole through whatever is behind it.
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}
