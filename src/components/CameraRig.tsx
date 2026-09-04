// oxlint-disable react/immutability -- Mutating the camera inside `useFrame`
// is the react-three-fiber idiom: the render loop lives outside React, so
// per-frame animation must not go through component state.
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { cellToWorld, scanExtent } from '../lib/maze/layout';
import type { Maze, Point } from '../lib/maze/types';
import type { CameraMode } from '../store/gameStore';

/** Third-person offset from the player, in world units. */
const GAMEPLAY_OFFSET = new THREE.Vector3(0, 9.5, 10);
const GAMEPLAY_FOV = 50;

/**
 * Scan mode uses a very narrow field of view from a correspondingly large
 * height. That is geometrically near-orthographic — perspective divergence
 * across a one-unit-tall wall at ~150 units of distance is well under a pixel —
 * while remaining a single camera that can be animated continuously. Swapping
 * to a real orthographic camera would force a hard cut mid-transition.
 */
const SCAN_FOV = 12;

/** Transition rate between the two camera poses (per second). */
const TRANSITION_RATE = 3.5;

interface CameraRigProps {
  readonly maze: Maze;
  readonly player: Point;
  readonly cameraMode: CameraMode;
}

/**
 * Drives the single scene camera between the angled gameplay view and the
 * flat top-down scanning view, interpolating position, target and field of
 * view so the change reads as one continuous movement.
 */
export function CameraRig({ maze, player, cameraMode }: CameraRigProps): null {
  const { camera } = useThree();

  const desiredPosition = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const currentTarget = useRef(new THREE.Vector3());
  const desiredUp = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const [playerX, playerZ] = cellToWorld(maze.size, player);

    if (cameraMode === 'scan') {
      // Height that frames the symbol, its quiet zone and the marker ring.
      const halfExtent = scanExtent(maze.size) / 2;
      const height = halfExtent / Math.tan(THREE.MathUtils.degToRad(SCAN_FOV / 2));

      desiredPosition.current.set(0, height, 0);
      desiredTarget.current.set(0, 0, 0);
    } else {
      desiredPosition.current.set(
        playerX + GAMEPLAY_OFFSET.x,
        GAMEPLAY_OFFSET.y,
        playerZ + GAMEPLAY_OFFSET.z,
      );
      desiredTarget.current.set(playerX, 0, playerZ);
    }

    const alpha = 1 - Math.exp(-TRANSITION_RATE * delta);
    camera.position.lerp(desiredPosition.current, alpha);
    currentTarget.current.lerp(desiredTarget.current, alpha);

    const targetFov = cameraMode === 'scan' ? SCAN_FOV : GAMEPLAY_FOV;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, alpha);
      camera.updateProjectionMatrix();
    }

    // Looking straight down makes the default +Y up-vector degenerate, so the
    // top-down view uses -Z as "up" to keep the symbol correctly oriented.
    // The vector is interpolated as well, otherwise the view would snap-roll
    // at the moment the mode changes.
    desiredUp.current.set(0, cameraMode === 'scan' ? 0 : 1, cameraMode === 'scan' ? -1 : 0);
    camera.up.lerp(desiredUp.current, alpha).normalize();
    camera.lookAt(currentTarget.current);
  });

  return null;
}
