/**
 * Canvas2D rendering path.
 * Renders decoded RGBA pixel data onto a Canvas element.
 */

import type { DecodedImage } from '../types/image';
import type { RenderOptions } from '../types/options';
import { calculateFitDimensions } from './scaler';
import { CanvasPool } from './canvas-pool';

const tempCanvasPool = new CanvasPool(2);

function resolveContainerDimensions(
  canvas: HTMLCanvasElement,
  image: DecodedImage,
  options: RenderOptions,
): { width: number; height: number } {
  if (options.width !== undefined && options.height !== undefined) {
    return { width: options.width, height: options.height };
  }

  const rect =
    typeof canvas.getBoundingClientRect === 'function'
      ? canvas.getBoundingClientRect()
      : { width: 0, height: 0 };

  const width = options.width ?? (rect.width || image.width);
  const height = options.height ?? (rect.height || image.height);
  return { width, height };
}

/**
 * Render a DecodedImage onto a Canvas element.
 *
 * The renderer owns the drawing buffer (canvas.width / canvas.height) and
 * never touches canvas.style — layout is always the caller's responsibility.
 */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  image: DecodedImage,
  options: RenderOptions = {},
): void {
  const { width, height } = resolveContainerDimensions(canvas, image, options);
  const fit = options.fit ?? 'contain';
  const background = options.background;
  const dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);

  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  if (image.bitmap) {
    const dims = calculateFitDimensions(image.width, image.height, width, height, fit);
    ctx.drawImage(image.bitmap, dims.x, dims.y, dims.width, dims.height);
    return;
  }

  const imageData = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const dims = calculateFitDimensions(image.width, image.height, width, height, fit);

  if (dims.width !== image.width || dims.height !== image.height) {
    const tempCanvas = tempCanvasPool.acquire(image.width, image.height);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, dims.x, dims.y, dims.width, dims.height);
    tempCanvasPool.release(tempCanvas);
  } else {
    ctx.putImageData(imageData, dims.x, dims.y);
  }
}
