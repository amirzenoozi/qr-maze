import { Canvas } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { floorExtent } from '../lib/maze/layout';
import { SKY } from '../lib/render/daylight';
import { useGameStore } from '../store/gameStore';
import { CameraRig } from './CameraRig';
import { Confetti } from './Confetti';
import { Fence } from './Fence';
import { Floor } from './Floor';
import { Flowers } from './Flowers';
import { Markers } from './Markers';
import { ScanMarkers } from './ScanMarkers';
import { Player } from './Player';
import { Trees } from './Trees';
import { Walls } from './Walls';

/**
 * Device-pixel ratio while playing. Rendering well below 1:1 and letting CSS
 * upscale with `image-rendering: pixelated` is what turns the whole scene into
 * pixel art — including the lighting and shadows, which no texture could do.
 */
const PIXEL_DPR = 0.45;

/**
 * Scan mode renders at full resolution instead. The symbol's edges have to
 * stay crisp for a phone camera to resolve the modules.
 */
const SCAN_DPR: [number, number] = [1, 2];

/**
 * The 3D stage. Renders nothing until a maze has been built, so the canvas is
 * only mounted once there is something to look at.
 */
export function Scene(): React.JSX.Element | null {
  const { maze, player, won, cameraMode, timeOfDay, skin } = useGameStore(
    useShallow((state) => ({
      maze: state.maze,
      player: state.player,
      won: state.won,
      cameraMode: state.cameraMode,
      timeOfDay: state.timeOfDay,
      skin: state.skin,
    })),
  );

  if (!maze) return null;

  const gameplay = cameraMode === 'gameplay';
  // The sun has to light the whole board, quiet zone included.
  const reach = floorExtent(maze.size) / 2;
  const sky = SKY[timeOfDay];

  return (
    <Canvas
      className="scene"
      // Shadows are only meaningful in gameplay mode; scan mode is deliberately
      // flat so the screen reads as a printed QR code.
      shadows={gameplay}
      dpr={gameplay ? PIXEL_DPR : SCAN_DPR}
      gl={{ antialias: false }}
      camera={{ position: [0, 12, 12], fov: 50, near: 0.1, far: 500 }}
    >
      <color attach="background" args={[gameplay ? sky.background : '#ffffff']} />

      {/* Scan mode is fully unlit: both materials switch to basic shading. */}
      {gameplay && (
        <>
          {/* Every value comes from the active sky; see lib/render/daylight. */}
          <ambientLight intensity={sky.ambient.intensity} color={sky.ambient.color} />
          <hemisphereLight
            intensity={sky.hemisphere.intensity}
            color={sky.hemisphere.color}
            groundColor={sky.hemisphere.groundColor}
          />
          <directionalLight
            // Low for long morning shadows by day, high by night: moonlight
            // rakes nothing, and a high caster keeps the hedges in relief.
            position={[
              reach * sky.sun.position[0],
              reach * sky.sun.position[1],
              reach * sky.sun.position[2],
            ]}
            intensity={sky.sun.intensity}
            color={sky.sun.color}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0012}
            shadow-camera-near={0.5}
            shadow-camera-far={reach * 4}
            shadow-camera-left={-reach}
            shadow-camera-right={reach}
            shadow-camera-top={reach}
            shadow-camera-bottom={-reach}
          />
        </>
      )}

      <Floor maze={maze} cameraMode={cameraMode} />
      <Fence maze={maze} cameraMode={cameraMode} />
      <Walls maze={maze} cameraMode={cameraMode} />
      <Flowers maze={maze} cameraMode={cameraMode} />
      <Trees maze={maze} cameraMode={cameraMode} />
      <Markers maze={maze} cameraMode={cameraMode} />
      <ScanMarkers maze={maze} player={player} cameraMode={cameraMode} />
      <Confetti maze={maze} active={won} cameraMode={cameraMode} />
      <Player
        maze={maze}
        player={player}
        cameraMode={cameraMode}
        timeOfDay={timeOfDay}
        skin={skin}
      />
      <CameraRig maze={maze} player={player} cameraMode={cameraMode} />
    </Canvas>
  );
}
