/**
 * AVIF WASM codec — wraps libheif-js for AVIF decoding.
 * libheif natively supports AVIF (HEIF container with AV1 codec).
 */

import type { Codec, DecodeOptions } from '../../types/codec';
import type { DecodedImage, ImageFormat } from '../../types/image';
import { ImageFormat as Format } from '../../types/image';
import { CodecError } from '../../errors/errors';
import { ErrorCodes } from '../../errors/codes';

/** Maximum pixel count to prevent OOM (256 MB of RGBA data = 67M pixels) */
const MAX_PIXEL_COUNT = 67_108_864; // 256 * 1024 * 1024 / 4

/**
 * AVIF decoder using libheif-js WASM.
 */
export class AvifCodec implements Codec {
  readonly name = 'avif-wasm';
  readonly formats: ReadonlyArray<ImageFormat> = [Format.AVIF];

  private heifModule: import('libheif-js').LibHeif | null = null;
  private initialized = false;

  /**
   * Initialize the libheif WASM module.
   * Must be called before decode(). Idempotent.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const libheif = await import('libheif-js');
      const factoryOrModule = libheif.default || libheif;
      const mod: import('libheif-js').LibHeif = typeof factoryOrModule === 'function'
        ? await Promise.resolve(factoryOrModule())
        : factoryOrModule;
      this.heifModule = mod;
      this.initialized = true;
    } catch (error) {
      throw new CodecError(
        ErrorCodes.CODEC_INIT_FAILED,
        `Failed to initialize libheif WASM: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Decode an AVIF buffer into RGBA pixel data.
   */
  async decode(buffer: ArrayBuffer, _options?: DecodeOptions): Promise<DecodedImage> {
    if (!this.initialized || !this.heifModule) {
      await this.init();
    }

    const heif = this.heifModule!;

    try {
      const decoder = new heif.HeifDecoder();
      const data = new Uint8Array(buffer);
      const images = decoder.decode(data);

      if (!images || images.length === 0) {
        throw new Error('No images found in AVIF container');
      }

      const image = images[0];
      const width = image.get_width();
      const height = image.get_height();

      if (width === 0 || height === 0) {
        throw new Error(`AVIF decoded to invalid dimensions: ${width}×${height}`);
      }

      const pixelCount = width * height;
      if (pixelCount > MAX_PIXEL_COUNT) {
        throw new Error(
          `AVIF dimensions ${width}×${height} (${pixelCount} pixels) exceed maximum allowed ${MAX_PIXEL_COUNT} pixels`,
        );
      }

      const imageData = await new Promise<import('libheif-js').HeifDisplayData>((resolve, reject) => {
        image.display(
          { data: new Uint8ClampedArray(width * height * 4), width, height },
          (displayData) => {
            if (!displayData) reject(new Error('AVIF display processing failed'));
            else resolve(displayData);
          }
        );
      });

      let disposed = false;
      return {
        data: imageData.data,
        width,
        height,
        format: Format.AVIF,
        orientation: 1,
        decodePath: 'wasm',
        dispose() {
          if (disposed) return;
          disposed = true;
        },
      };
    } catch (error) {
      if (error instanceof CodecError) throw error;
      throw new CodecError(
        ErrorCodes.AVIF_DECODE_FAILED,
        `AVIF decode failed: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Dispose WASM resources.
   */
  dispose(): void {
    this.heifModule = null;
    this.initialized = false;
  }
}
