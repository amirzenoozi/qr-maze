import { useLayoutEffect, useRef } from 'react';
import type { Maze } from '../lib/maze/types';
import { QR_STYLES, renderQr } from '../lib/qr/render';

/** Light margin, in modules. The QR spec requires at least four. */
const QUIET_ZONE = 4;

/** Preset used everywhere. Every preset is decode-tested in `render.test.ts`. */
const STYLE = QR_STYLES.rounded;

interface QrCanvasProps {
  readonly maze: Maze;
  /** Canvas pixels per module. Raise it when the code is shown large. */
  readonly modulePx?: number;
  readonly className?: string;
}

/**
 * The live maze drawn as a scannable QR code.
 *
 * This draws the *carved* matrix — the same modules the player walks through —
 * which `buildMaze` has already round-tripped through a real decoder, so what
 * a phone reads here is exactly the maze on screen.
 *
 * It is drawn flat to a 2D canvas rather than captured from the 3D scene: no
 * camera angle, lighting or hedge can interfere, so scanning works during
 * normal play instead of only in the top-down view.
 *
 * The styling (rounded modules, rounded finder eyes) comes from a pure
 * matrix-to-RGBA renderer, which lets the test suite push the exact pixels the
 * browser shows through a real decoder. Styling can therefore never silently
 * break scanning.
 */
export function QrCanvas({
  maze,
  modulePx = 10,
  className,
}: QrCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const raster = renderQr(maze.modules, maze.size, {
      ...STYLE,
      scale: modulePx,
      quietZone: QUIET_ZONE,
    });

    canvas.width = raster.width;
    canvas.height = raster.height;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
  }, [maze, modulePx]);

  return (
    /*
      The canvas is deliberately larger than its CSS box and left to the
      browser's smooth downscaler. Nearest-neighbour downscaling — the
      `pixelated` mode used everywhere else in this UI — can drop entire module
      rows on the floor and silently break the code.
    */
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={`QR code for ${maze.url}`}
    />
  );
}
