import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, cellToWorld } from '../lib/maze/layout';
import type { Maze, Point } from '../lib/maze/types';
import { getBallTexture } from '../lib/render/ballTextures';
import { SKY, type TimeOfDay } from '../lib/render/daylight';
import { SKIN, type PlayerSkinId, type SkinShape } from '../lib/render/skins';
import type { CameraMode } from '../store/gameStore';

const RADIUS = CELL_SIZE * 0.3;
/** Sized so a rolling cube clears the floor and still fits a one-module corridor. */
const CUBE_SIDE = CELL_SIZE * 0.52;
/** The real balls sit a shade larger, which is what makes them read as balls. */
const BALL_RADIUS = RADIUS * 1.07;
const ROCK_RADIUS = RADIUS * 1.15;
/**
 * Ride height, shared by every body.
 *
 * It has to clear the furthest point of the widest shape as it turns: the
 * octahedron's vertex at 0.375 and the cube's half-diagonal at 0.368 both sit
 * under this, and the tallest of them still passes below the one-unit hedges.
 */
const RESTING_Y = RADIUS * 1.4;

/** How quickly the body converges on its target cell (per second). */
const FOLLOW_RATE = 12;
const BOB_RATE = 2.4;
const BOB_HEIGHT = CELL_SIZE * 0.05;
const SPIN_RATE = 1.1;
const TUMBLE_RATE = 1.4;

interface PlayerProps {
  readonly maze: Maze;
  readonly player: Point;
  readonly cameraMode: CameraMode;
  readonly timeOfDay: TimeOfDay;
  readonly skin: PlayerSkinId;
}

/**
 * How far a body turns per cell travelled.
 *
 * Round bodies use the real arc length, so a ball covering one module turns
 * exactly as far as its circumference says it should — anything else reads as
 * a ball skidding. The cube instead tips a quarter turn onto its next face,
 * which is what a block does regardless of how far the cell is.
 */
function rollAngle(shape: SkinShape): number {
  switch (shape) {
    case 'ball':
      return CELL_SIZE / BALL_RADIUS;
    case 'rock':
      return CELL_SIZE / ROCK_RADIUS;
    default:
      return Math.PI / 2;
  }
}

/** The primitive for a body, kept low-poly to match the faceted world. */
function SkinGeometry({ shape }: { readonly shape: SkinShape }): React.JSX.Element {
  switch (shape) {
    case 'octahedron':
      return <octahedronGeometry args={[RADIUS * 1.25, 0]} />;
    case 'icosahedron':
      return <icosahedronGeometry args={[RADIUS * 1.1, 0]} />;
    case 'cube':
      return <boxGeometry args={[CUBE_SIDE, CUBE_SIDE, CUBE_SIDE]} />;
    case 'rock':
      // Twelve flat pentagons. Chunky enough to read as broken stone, and
      // three.js maps polyhedron UVs by spherical angle, so the crack texture
      // still wraps it.
      return <dodecahedronGeometry args={[ROCK_RADIUS, 0]} />;
    case 'ball':
      // Rounder and smooth-shaded, because a texture on eight facets reads as
      // a painted gem rather than as a ball.
      return <sphereGeometry args={[BALL_RADIUS, 16, 12]} />;
    default:
      // Deliberately low-poly: a smooth 32-segment sphere would be the one
      // round, high-detail object in an otherwise faceted pixel world.
      return <sphereGeometry args={[RADIUS, 8, 6]} />;
  }
}

/**
 * The player's body and its attached point light.
 *
 * Movement is authoritative on the integer grid (which makes collision exact —
 * a blocked move is simply never committed to the store). This component only
 * smooths the visual position toward the current cell, so the body can never
 * drift into a wall.
 *
 * The body is hidden in scan mode so it cannot occlude a module while the
 * symbol is being scanned. Three.js skips invisible lights too, so the lantern
 * goes out with it.
 */
export function Player({
  maze,
  player,
  cameraMode,
  timeOfDay,
  skin: skinId,
}: PlayerProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const target = useRef(new THREE.Vector3());

  // Rolling state. The cube accumulates a quarter turn per committed move, so
  // the face that was on top ends up where it travelled.
  const seen = useRef(player);
  const roll = useRef(new THREE.Quaternion());
  const step = useRef(new THREE.Vector3());
  const axis = useRef(new THREE.Vector3());
  const quarter = useRef(new THREE.Quaternion());
  const tumbleAxis = useRef(new THREE.Vector3(0.4, 1, 0.28).normalize());

  const glow = SKY[timeOfDay].glow;
  const skin = SKIN[skinId];
  const map = skin.texture ? getBallTexture(skin.texture) : null;
  const turn = rollAngle(skin.shape);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;

    const [x, z] = cellToWorld(maze.size, player);
    target.current.set(x, RESTING_Y, z);

    // Frame-rate independent exponential smoothing.
    const alpha = 1 - Math.exp(-FOLLOW_RATE * delta);
    group.position.lerp(target.current, alpha);

    // The store hands back a fresh point object per move, so identity is a
    // reliable "did we step" test. Anything longer than one cell is a teleport
    // — a restart, or a rebuild — and must not spin the body.
    if (seen.current !== player) {
      const deltaRow = player.row - seen.current.row;
      const deltaCol = player.col - seen.current.col;
      seen.current = player;

      if (Math.abs(deltaRow) + Math.abs(deltaCol) === 1) {
        // Grid rows run along +Z and columns along +X.
        step.current.set(deltaCol, 0, deltaRow);
        axis.current.set(0, 1, 0).cross(step.current);
        quarter.current.setFromAxisAngle(axis.current, turn);
        roll.current.premultiply(quarter.current);
      }
    }

    switch (skin.motion) {
      case 'bob':
        body.position.y = Math.sin(state.clock.elapsedTime * BOB_RATE) * BOB_HEIGHT;
        break;
      case 'spin':
        body.rotation.y += delta * SPIN_RATE;
        break;
      case 'tumble':
        body.rotateOnAxis(tumbleAxis.current, delta * TUMBLE_RATE);
        break;
      case 'roll':
        // A true roll would pivot on the leading edge. At this size and speed
        // the difference is under a pixel, and turning about the centre keeps
        // rotation and translation independent.
        body.quaternion.slerp(roll.current, alpha);
        break;
    }
  });

  return (
    <group ref={groupRef} visible={cameraMode === 'gameplay'}>
      {/* Keyed on the body so a change resets the transform the previous
          motion left behind, as well as swapping the geometry. */}
      <mesh key={skinId} ref={bodyRef} castShadow>
        <SkinGeometry shape={skin.shape} />
        <meshStandardMaterial
          map={map}
          // The map doubles as the emissive map, so a body lit from inside
          // still shows its pattern instead of glowing flat.
          emissiveMap={map}
          color={skin.color}
          emissive={skin.emissive}
          emissiveIntensity={glow.emissiveIntensity * (skin.emissiveScale ?? 1)}
          roughness={map ? 0.55 : 0.25}
          flatShading={skin.shape !== 'ball'}
        />
      </mesh>

      {/* Travels with the body and casts the maze's real-time shadows. Dimmed
          by day, where a morning sun reduces it to the body's own glow; turned
          up at night, where it becomes the main light source. The body then
          trims that: a coal burns hot and close, a cold star reaches further. */}
      <pointLight
        castShadow
        color={skin.light}
        intensity={glow.intensity * skin.glow.intensity}
        distance={glow.distance * skin.glow.distance}
        decay={2}
        position={[0, CELL_SIZE * 0.9, 0]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0015}
      />
    </group>
  );
}
