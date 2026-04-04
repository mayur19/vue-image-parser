/**
 * AVIF WASM codec — wraps @jsquash/avif for AVIF decoding.
 */

import type { Codec, DecodeOptions } from '../../types/codec';
import type { DecodedImage, ImageFormat } from '../../types/image';
import { ImageFormat as Format } from '../../types/image';
import { CodecError } from '../../errors/errors';
import { ErrorCodes } from '../../errors/codes';

/**
 * AVIF decoder using @jsquash/avif WASM.
 */
export class AvifCodec implements Codec {
  readonly name = 'avif-wasm';
  readonly formats: ReadonlyArray<ImageFormat> = [Format.AVIF];

  private decodeFn: ((buffer: ArrayBuffer) => Promise<ImageData>) | null = null;
  private initialized = false;

  /**
   * Initialize the @jsquash/avif WASM module.
   * Must be called before decode(). Idempotent.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const avifModule = await import('@jsquash/avif/decode');
      this.decodeFn = avifModule.default ?? avifModule.decode;
      this.initialized = true;
    } catch (error) {
      throw new CodecError(
        ErrorCodes.CODEC_INIT_FAILED,
        `Failed to initialize @jsquash/avif WASM: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Decode an AVIF buffer into RGBA pixel data.
   */
  async decode(buffer: ArrayBuffer, _options?: DecodeOptions): Promise<DecodedImage> {
    if (!this.initialized || !this.decodeFn) {
      await this.init();
    }

    try {
      const imageData = await this.decodeFn!(buffer);

      if (imageData.width === 0 || imageData.height === 0) {
        throw new Error(`AVIF decoded to invalid dimensions: ${imageData.width}×${imageData.height}`);
      }

      let disposed = false;
      return {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
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
    this.decodeFn = null;
    this.initialized = false;
  }
}
