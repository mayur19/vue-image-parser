/**
 * renderImage() — High-level rendering orchestrator.
 * Renders a DecodedImage onto a target element.
 */

import type { DecodedImage } from '../types/image';
import type { RenderOptions, RenderTarget } from '../types/options';
import { renderToCanvas } from './canvas-renderer';
import { ImageParserError } from '../errors/errors';
import { ErrorCodes } from '../errors/codes';
import { assertBrowser } from '../utils/ssr';

/**
 * Render a decoded image onto a target element.
 *
 * - HTMLCanvasElement: draws directly using Canvas2D
 * - HTMLElement: creates an internal canvas and appends it
 *
 * @throws ImageParserError if rendering fails
 */
export function renderImage(
  target: RenderTarget,
  image: DecodedImage,
  options: RenderOptions = {},
): void {
  assertBrowser('renderImage()');

  if (target instanceof HTMLCanvasElement) {
    renderToCanvas(target, image, options);
    return;
  }

  // For non-canvas elements, create a canvas inside
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  const rect = target.getBoundingClientRect();
  const renderOptions: RenderOptions = {
    width: options.width ?? (rect.width || image.width),
    height: options.height ?? (rect.height || image.height),
    ...options,
  };

  try {
    renderToCanvas(canvas, image, renderOptions);
    // Clear existing children
    target.innerHTML = '';
    target.appendChild(canvas);
  } catch (error) {
    throw new ImageParserError(
      ErrorCodes.RENDER_FAILED,
      `Failed to render image: ${(error as Error).message}`,
      error,
    );
  }
}
