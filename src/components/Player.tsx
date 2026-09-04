import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, cellToWorld } from '../lib/maze/layout';
import type { Maze, Point } from '../lib/maze/types';
import { SKY, type TimeOfDay } from '../lib/render/daylight';
import type { CameraMode } from '../store/gameStore';

const RADIUS = CELL_SIZE * 0.3;
/** How quickly the sphere converges on its target cell (per second). */
const FOLLOW_RATE = 12;

interface PlayerProps {
  readonly maze: Maze;
  readonly player: Point;
  readonly cameraMode: CameraMode;
  readonly timeOfDay: TimeOfDay;
}

/**
 * The player's glowing sphere and its attached point light.
 *
 * Movement is authoritative on the integer grid (which makes collision exact —
 * a blocked move is simply never committed to the store). This component only
 * smooths the visual position toward the current cell, so the sphere can never
 * drift into a wall.
 *
 * The sphere is hidden in scan mode so it cannot occlude a module while the
 * symbol is being scanned.
 */
export function Player({ maze, player, cameraMode, timeOfDay }: PlayerProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3());
  const glow = SKY[timeOfDay].glow;

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const [x, z] = cellToWorld(maze.size, player);
    target.current.set(x, RADIUS * 1.4, z);

    // Frame-rate independent exponential smoothing.
    const alpha = 1 - Math.exp(-FOLLOW_RATE * delta);
    group.position.lerp(target.current, alpha);
  });

  return (
    <group ref={groupRef} visible={cameraMode === 'gameplay'}>
      <mesh castShadow>
        {/* Deliberately low-poly: a smooth 32-segment sphere would be the one
            round, high-detail object in an otherwise faceted pixel world. */}
        <sphereGeometry args={[RADIUS, 8, 6]} />
        <meshStandardMaterial
          color="#7de2ff"
          emissive="#37c6ff"
          emissiveIntensity={glow.emissiveIntensity}
          roughness={0.25}
          flatShading
        />
      </mesh>

      {/* Travels with the sphere and casts the maze's real-time shadows.
          Dimmed by day, where a morning sun reduces it to the sphere's own
          glow; turned up at night, where it becomes the main light source. */}
      <pointLight
        castShadow
        color="#8fe3ff"
        intensity={glow.intensity}
        distance={glow.distance}
        decay={2}
        position={[0, CELL_SIZE * 0.9, 0]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0015}
      />
    </group>
  );
}
