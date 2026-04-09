/**
 * Canvas2D rendering path.
 * Renders decoded RGBA pixel data onto a Canvas element.
 */

import type { DecodedImage } from '../types/image';
import type { RenderOptions } from '../types/options';
import { calculateFitDimensions } from './scaler';
import { CanvasPool } from './canvas-pool';

const tempCanvasPool = new CanvasPool(2);

/**
 * Render a DecodedImage onto a Canvas element.
 */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  image: DecodedImage,
  options: RenderOptions = {},
): void {
  const {
    width = image.width,
    height = image.height,
    fit = 'contain',
    background,
    dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  } = options;

  // Set canvas dimensions accounting for device pixel ratio
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  // Fill background if specified
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  // Fast path: if decoded image has a live ImageBitmap, use drawImage directly
  if (image.bitmap) {
    const dims = calculateFitDimensions(image.width, image.height, width, height, fit);
    ctx.drawImage(image.bitmap, dims.x, dims.y, dims.width, dims.height);
    return;
  }

  // Create ImageData from decoded RGBA
  const imageData = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);

  // Calculate fit dimensions
  const dims = calculateFitDimensions(image.width, image.height, width, height, fit);

  // For non-1:1 rendering, we need a temp canvas
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
