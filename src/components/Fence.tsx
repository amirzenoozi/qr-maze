import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SIZE, boardExtent } from '../lib/maze/layout';
import type { Maze } from '../lib/maze/types';
import { getPixelTextures } from '../lib/render/pixelTextures';
import type { CameraMode } from '../store/gameStore';

/**
 * Gap between the outermost module and the fence line, in cells.
 *
 * The quiet zone is four cells wide, so this leaves the fence well inside the
 * floor while keeping a strip of grass between the hedges and the timber.
 */
const MARGIN = CELL_SIZE * 1.5;

/** Target distance between posts. Actual spacing is rounded to fit the side. */
const POST_SPACING = CELL_SIZE * 2.5;

const POST_WIDTH = CELL_SIZE * 0.26;
const POST_HEIGHT = CELL_SIZE * 1.5;
const CAP_WIDTH = CELL_SIZE * 0.38;
const CAP_HEIGHT = CELL_SIZE * 0.16;

const RAIL_HEIGHT = CELL_SIZE * 0.2;
const RAIL_DEPTH = CELL_SIZE * 0.12;
/** Heights of the two horizontal rails. */
const RAIL_LEVELS = [CELL_SIZE * 0.52, CELL_SIZE * 1.08];

/** World units of rail covered by one repeat of the wood texture. */
const WOOD_TILE = CELL_SIZE * 1.5;

interface FenceProps {
  readonly maze: Maze;
  readonly cameraMode: CameraMode;
}

/**
 * A wooden fence ringing the whole symbol.
 *
 * Gameplay only. The fence stands inside the quiet zone, which is the one
 * region a decoder requires to be blank — drawing it in scan mode would put
 * timber exactly where a scanner looks for white space.
 *
 * Posts and caps are instanced; the eight rails are plain meshes, because each
 * needs its own texture stretch and there are only eight of them.
 */
export function Fence({ maze, cameraMode }: FenceProps): React.JSX.Element | null {
  const postsRef = useRef<THREE.InstancedMesh>(null);
  const capsRef = useRef<THREE.InstancedMesh>(null);

  /** Distance from the origin to the fence line on each axis. */
  const half = boardExtent(maze.size) / 2 + MARGIN;
  // Overhang the corners so the rails meet behind the corner posts.
  const railLength = half * 2 + POST_WIDTH;

  const posts = useMemo(() => {
    const span = half * 2;
    const steps = Math.max(2, Math.round(span / POST_SPACING));
    const seen = new Set<string>();
    const result: Array<[number, number]> = [];

    // Corner posts are generated once per adjoining side, so dedupe them.
    const add = (x: number, z: number): void => {
      const key = `${x.toFixed(3)}:${z.toFixed(3)}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push([x, z]);
    };

    for (let i = 0; i <= steps; i++) {
      const t = -half + (span * i) / steps;
      add(t, -half);
      add(t, half);
      add(-half, t);
      add(half, t);
    }

    return result;
  }, [half]);

  const materials = useMemo(() => {
    const { wood } = getPixelTextures();

    // Each part needs its own texture stretch, so each gets its own clone.
    // Cloning shares the underlying image; three ref-counts it, so the cached
    // original survives disposal here.
    const postMap = wood.clone();
    postMap.needsUpdate = true;
    postMap.repeat.set(1, POST_HEIGHT / WOOD_TILE);

    const capMap = wood.clone();
    capMap.needsUpdate = true;

    const railMap = wood.clone();
    railMap.needsUpdate = true;
    railMap.repeat.set(railLength / WOOD_TILE, 1);

    return {
      post: new THREE.MeshStandardMaterial({ map: postMap, roughness: 0.85 }),
      cap: new THREE.MeshStandardMaterial({ map: capMap, roughness: 0.85 }),
      rail: new THREE.MeshStandardMaterial({ map: railMap, roughness: 0.85 }),
    };
  }, [railLength]);

  // Clones and materials are owned here, so they are released on change.
  useLayoutEffect(() => {
    return () => {
      Object.values(materials).forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    };
  }, [materials]);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();

    posts.forEach(([x, z], i) => {
      matrix.setPosition(x, POST_HEIGHT / 2, z);
      postsRef.current?.setMatrixAt(i, matrix);

      matrix.setPosition(x, POST_HEIGHT + CAP_HEIGHT / 2, z);
      capsRef.current?.setMatrixAt(i, matrix);
    });

    for (const mesh of [postsRef.current, capsRef.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [posts, materials]);

  if (cameraMode === 'scan') return null;

  return (
    <group>
      <instancedMesh
        // Instance count is fixed at construction, so remount when it changes.
        key={`posts-${posts.length}`}
        ref={postsRef}
        args={[undefined, undefined, posts.length]}
        material={materials.post}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[POST_WIDTH, POST_HEIGHT, POST_WIDTH]} />
      </instancedMesh>

      <instancedMesh
        key={`caps-${posts.length}`}
        ref={capsRef}
        args={[undefined, undefined, posts.length]}
        material={materials.cap}
        castShadow
      >
        <boxGeometry args={[CAP_WIDTH, CAP_HEIGHT, CAP_WIDTH]} />
      </instancedMesh>

      {RAIL_LEVELS.map((y) => (
        <group key={y}>
          {/* North and south rails run along X. */}
          <mesh position={[0, y, -half]} material={materials.rail} castShadow receiveShadow>
            <boxGeometry args={[railLength, RAIL_HEIGHT, RAIL_DEPTH]} />
          </mesh>
          <mesh position={[0, y, half]} material={materials.rail} castShadow receiveShadow>
            <boxGeometry args={[railLength, RAIL_HEIGHT, RAIL_DEPTH]} />
          </mesh>
          {/* West and east rails are the same bar turned a quarter turn. */}
          <mesh
            position={[-half, y, 0]}
            rotation={[0, Math.PI / 2, 0]}
            material={materials.rail}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[railLength, RAIL_HEIGHT, RAIL_DEPTH]} />
          </mesh>
          <mesh
            position={[half, y, 0]}
            rotation={[0, Math.PI / 2, 0]}
            material={materials.rail}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[railLength, RAIL_HEIGHT, RAIL_DEPTH]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
