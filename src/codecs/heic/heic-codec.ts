/**
 * HEIC WASM codec — wraps libheif-js for HEIC/HEIF decoding.
 */

import type { Codec, DecodeOptions } from '../../types/codec';
import type { DecodedImage, ImageFormat } from '../../types/image';
import { ImageFormat as Format } from '../../types/image';
import { CodecError } from '../../errors/errors';
import { ErrorCodes } from '../../errors/codes';

/**
 * HEIC decoder using libheif-js WASM.
 */
export class HeicCodec implements Codec {
  readonly name = 'heic-wasm';
  readonly formats: ReadonlyArray<ImageFormat> = [Format.HEIC, Format.HEIF];

  private heifModule: any = null;
  private initialized = false;

  /**
   * Initialize the libheif WASM module.
   * Must be called before decode(). Idempotent.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import for tree-shaking
      const libheif = await import('libheif-js');
      let mod: any = libheif.default || libheif;
      if (typeof mod === 'function') {
        mod = await mod();
      }
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
   * Decode a HEIC/HEIF buffer into RGBA pixel data.
   */
  async decode(buffer: ArrayBuffer, _options?: DecodeOptions): Promise<DecodedImage> {
    if (!this.initialized || !this.heifModule) {
      await this.init();
    }

    try {
      const decoder = new this.heifModule.HeifDecoder();
      const data = new Uint8Array(buffer);
      const images = decoder.decode(data);

      if (!images || images.length === 0) {
        throw new Error('No images found in HEIC container');
      }

      const image = images[0];
      const width = image.get_width();
      const height = image.get_height();

      if (width === 0 || height === 0) {
        throw new Error(`HEIC decoded to invalid dimensions: ${width}×${height}`);
      }

      // Get RGBA pixel data
      const imageData = await new Promise<any>((resolve, reject) => {
        image.display(
          { data: new Uint8ClampedArray(width * height * 4), width, height },
          (displayData: any) => {
            if (!displayData) reject(new Error('HEIC display processing failed'));
            else resolve(displayData);
          }
        );
      });

      let disposed = false;
      return {
        data: imageData.data,
        width,
        height,
        format: Format.HEIC,
        orientation: 1,
        decodePath: 'wasm',
        dispose() {
          if (disposed) return;
          disposed = true;
          // libheif handles its own cleanup
        },
      };
    } catch (error) {
      if (error instanceof CodecError) throw error;
      throw new CodecError(
        ErrorCodes.HEIC_DECODE_FAILED,
        `HEIC decode failed: ${(error as Error).message}`,
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
