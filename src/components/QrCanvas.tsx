import { useLayoutEffect, useRef } from 'react';

import { DEFAULT_STYLE, renderQr, type QrStyle } from '../lib/qr/render';

/** Light margin, in modules. Decoders need it to find the symbol edge. */
const QUIET_ZONE = 4;

interface QrCanvasProps {
  /** Row-major module buffer, 1 = dark. */
  readonly modules: Uint8Array;
  readonly size: number;
  /** Accessible description of what this code points at. */
  readonly label: string;
  readonly style?: QrStyle;
  readonly modulePx?: number;
  /** Lets the owner reach the pixels, for download and share. */
  readonly canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  readonly className?: string;
}

/**
 * Draws a matrix to a 2D canvas.
 *
 * Flat, not captured from the 3D scene: camera angle, lighting and hedges
 * would all get in the way of a decoder, and this way the code is readable
 * during normal play.
 */
export function QrCanvas({
  modules,
  size,
  label,
  style = DEFAULT_STYLE,
  modulePx = 10,
  canvasRef,
  className,
}: QrCanvasProps): React.JSX.Element {
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef ?? fallbackRef;

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (canvas === null) {
      return;
    }

    const raster = renderQr(modules, size, { ...style, scale: modulePx, quietZone: QUIET_ZONE });
    canvas.width = raster.width;
    canvas.height = raster.height;

    const context = canvas.getContext('2d');
    if (context === null) {
      return;
    }

    context.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
  }, [ref, modules, size, style, modulePx]);

  return (
    // The canvas is deliberately larger than its CSS box and left to the
    // browser's smooth downscaler. Nearest-neighbour scaling, which the rest of
    // the pixel-art UI uses, can drop whole module rows and break the code.
    <canvas ref={ref} className={className} role="img" aria-label={label} />
  );
}
