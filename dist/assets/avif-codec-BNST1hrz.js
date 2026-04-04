import { I as ImageFormat } from "./decode-worker-Bxk1S_sD.js";
import { C as CodecError, E as ErrorCodes } from "./codes-DxOpu-G1.js";
class AvifCodec {
  constructor() {
    this.name = "avif-wasm";
    this.formats = [ImageFormat.AVIF];
    this.decodeFn = null;
    this.initialized = false;
  }
  /**
   * Initialize the @jsquash/avif WASM module.
   * Must be called before decode(). Idempotent.
   */
  async init() {
    if (this.initialized) return;
    try {
      const avifModule = await import("./decode-D3zhSvgX.js");
      this.decodeFn = avifModule.default ?? avifModule.decode;
      this.initialized = true;
    } catch (error) {
      throw new CodecError(
        ErrorCodes.CODEC_INIT_FAILED,
        `Failed to initialize @jsquash/avif WASM: ${error.message}`,
        error
      );
    }
  }
  /**
   * Decode an AVIF buffer into RGBA pixel data.
   */
  async decode(buffer, _options) {
    if (!this.initialized || !this.decodeFn) {
      await this.init();
    }
    try {
      const imageData = await this.decodeFn(buffer);
      if (imageData.width === 0 || imageData.height === 0) {
        throw new Error(`AVIF decoded to invalid dimensions: ${imageData.width}×${imageData.height}`);
      }
      let disposed = false;
      return {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
        format: ImageFormat.AVIF,
        orientation: 1,
        decodePath: "wasm",
        dispose() {
          if (disposed) return;
          disposed = true;
        }
      };
    } catch (error) {
      if (error instanceof CodecError) throw error;
      throw new CodecError(
        ErrorCodes.AVIF_DECODE_FAILED,
        `AVIF decode failed: ${error.message}`,
        error
      );
    }
  }
  /**
   * Dispose WASM resources.
   */
  dispose() {
    this.decodeFn = null;
    this.initialized = false;
  }
}
export {
  AvifCodec
};
//# sourceMappingURL=avif-codec-BNST1hrz.js.map
