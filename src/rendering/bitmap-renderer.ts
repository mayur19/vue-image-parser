/**
 * ImageBitmap rendering path.
 * When possible, converts decoded RGBA data to ImageBitmap
 * for GPU-accelerated rendering.
 */

import type { DecodedImage } from '../types/image';
import { hasCreateImageBitmap } from '../utils/ssr';

/**
 * Convert a DecodedImage to an ImageBitmap for efficient rendering.
 * Returns null if ImageBitmap is not available.
 */
export async function toImageBitmap(image: DecodedImage): Promise<ImageBitmap | null> {
  if (!hasCreateImageBitmap()) return null;

  try {
    const imageData = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    return await createImageBitmap(imageData);
  } catch {
    return null;
  }
}

/**
 * Create a data URL from decoded image data.
 * Useful for setting as <img> src attribute.
 */
export function toDataURL(image: DecodedImage, mimeType: string = 'image/png'): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL(mimeType);
}

/**
 * Create a Blob URL from decoded image data.
 * More memory-efficient than data URLs for large images.
 * Remember to call URL.revokeObjectURL() when done.
 */
export async function toBlobURL(
  image: DecodedImage,
  mimeType: string = 'image/png',
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  ctx.putImageData(imageData, 0, 0);

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      mimeType,
    );
  });
}
