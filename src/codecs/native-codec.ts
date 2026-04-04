/**
 * Native browser codec — uses createImageBitmap for decoding.
 * Reports failures back to CapabilityRegistry for runtime feedback.
 *
 * The bitmap is kept alive after decode so renderers can use drawImage()
 * directly (GPU path). RGBA pixel data is read lazily only when accessed.
 */

import type { Codec, DecodeOptions } from '../types/codec';
import type { DecodedImage, ImageFormat } from '../types/image';
import { ImageFormat as Format } from '../types/image';
import { CodecError } from '../errors/errors';
import { ErrorCodes } from '../errors/codes';
import { hasCreateImageBitmap, hasOffscreenCanvas } from '../utils/ssr';

/**
 * Read RGBA pixel data from an ImageBitmap using an OffscreenCanvas if
 * available, falling back to a regular canvas element on the main thread.
 */
function readPixelsFromBitmap(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray {
  if (hasOffscreenCanvas()) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  }

  // Fallback: regular canvas (main thread only)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, width, height).data;
}

/**
 * Native browser codec. Decodes images using createImageBitmap().
 * Supports all formats the browser natively supports.
 */
export class NativeCodec implements Codec {
  readonly name = 'native-browser';
  readonly formats: ReadonlyArray<ImageFormat> = [
    Format.JPEG,
    Format.PNG,
    Format.WebP,
    Format.GIF,
    Format.AVIF,
    Format.HEIC,
    Format.HEIF,
  ];

  /**
   * Failure callback — injected by the engine to report runtime failures
   * back to the CapabilityRegistry.
   */
  onDecodeFailure?: (format: ImageFormat, error: Error) => void;

  async decode(buffer: ArrayBuffer, _options?: DecodeOptions): Promise<DecodedImage> {
    if (!hasCreateImageBitmap()) {
      throw new CodecError(
        ErrorCodes.DECODE_FAILED,
        'createImageBitmap is not available',
      );
    }

    const blob = new Blob([buffer]);

    try {
      const bitmap = await createImageBitmap(blob);

      // Guard against 0×0 bitmaps (WebView edge case)
      if (bitmap.width === 0 || bitmap.height === 0) {
        bitmap.close();
        throw new CodecError(
          ErrorCodes.DECODE_FAILED,
          `Native decode returned 0×0 bitmap`,
        );
      }

      const width = bitmap.width;
      const height = bitmap.height;
      let pixelData: Uint8ClampedArray | null = null;
      let disposed = false;

      const decoded: DecodedImage = {
        get data(): Uint8ClampedArray {
          if (disposed) {
            throw new CodecError(
              ErrorCodes.DECODE_FAILED,
              'Cannot access pixel data after dispose',
            );
          }
          if (!pixelData) {
            pixelData = readPixelsFromBitmap(bitmap, width, height);
          }
          return pixelData;
        },
        width,
        height,
        format: Format.Unknown, // Caller sets this
        orientation: 1,
        decodePath: 'native',
        bitmap,
        dispose() {
          if (disposed) return;
          disposed = true;
          bitmap.close();
          pixelData = null;
        },
      };

      return decoded;
    } catch (error) {
      if (error instanceof CodecError) throw error;

      const codecError = new CodecError(
        ErrorCodes.NATIVE_DECODE_FAILED,
        `Native decode failed: ${(error as Error).message}`,
        error,
      );

      // Report failure back to capability system
      this.onDecodeFailure?.(Format.Unknown, codecError);

      throw codecError;
    }
  }
}
