/**
 * Native browser codec — uses createImageBitmap for decoding.
 * Reports failures back to CapabilityRegistry for runtime feedback.
 */

import type { Codec, DecodeOptions } from '../types/codec';
import type { DecodedImage, ImageFormat } from '../types/image';
import { ImageFormat as Format } from '../types/image';
import { CodecError } from '../errors/errors';
import { ErrorCodes } from '../errors/codes';
import { hasCreateImageBitmap, hasOffscreenCanvas } from '../utils/ssr';

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

  async decode(buffer: ArrayBuffer, options?: DecodeOptions): Promise<DecodedImage> {
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

      // Read pixel data from the bitmap
      const pixelData = this.readPixels(bitmap, options);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();

      let disposed = false;
      return {
        data: pixelData,
        width,
        height,
        format: Format.Unknown, // Caller sets this
        orientation: 1,
        decodePath: 'native',
        dispose() {
          if (disposed) return;
          disposed = true;
        },
      };
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

  /**
   * Read RGBA pixel data from an ImageBitmap.
   */
  private readPixels(bitmap: ImageBitmap, _options?: DecodeOptions): Uint8ClampedArray {
    const { width, height } = bitmap;

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
}
