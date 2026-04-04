import { I as ImageFormat, C as CodecError, E as ErrorCodes } from "../../chunks/codes-Dq73-3CT.js";
class HeicCodec {
  constructor() {
    this.name = "heic-wasm";
    this.formats = [ImageFormat.HEIC, ImageFormat.HEIF];
    this.heifModule = null;
    this.initialized = false;
  }
  /**
   * Initialize the libheif WASM module.
   * Must be called before decode(). Idempotent.
   */
  async init() {
    if (this.initialized) return;
    try {
      const libheif = await import("../../chunks/index-B52GqwGV.js").then((n) => n.i);
      let mod = libheif.default || libheif;
      if (typeof mod === "function") {
        mod = await mod();
      }
      this.heifModule = mod;
      this.initialized = true;
    } catch (error) {
      throw new CodecError(
        ErrorCodes.CODEC_INIT_FAILED,
        `Failed to initialize libheif WASM: ${error.message}`,
        error
      );
    }
  }
  /**
   * Decode a HEIC/HEIF buffer into RGBA pixel data.
   */
  async decode(buffer, _options) {
    if (!this.initialized || !this.heifModule) {
      await this.init();
    }
    try {
      const decoder = new this.heifModule.HeifDecoder();
      const data = new Uint8Array(buffer);
      const images = decoder.decode(data);
      if (!images || images.length === 0) {
        throw new Error("No images found in HEIC container");
      }
      const image = images[0];
      const width = image.get_width();
      const height = image.get_height();
      if (width === 0 || height === 0) {
        throw new Error(`HEIC decoded to invalid dimensions: ${width}×${height}`);
      }
      const imageData = await new Promise((resolve, reject) => {
        image.display(
          { data: new Uint8ClampedArray(width * height * 4), width, height },
          (displayData) => {
            if (!displayData) reject(new Error("HEIC display processing failed"));
            else resolve(displayData);
          }
        );
      });
      let disposed = false;
      return {
        data: imageData.data,
        width,
        height,
        format: ImageFormat.HEIC,
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
        ErrorCodes.HEIC_DECODE_FAILED,
        `HEIC decode failed: ${error.message}`,
        error
      );
    }
  }
  /**
   * Dispose WASM resources.
   */
  dispose() {
    this.heifModule = null;
    this.initialized = false;
  }
}
export {
  HeicCodec
};
//# sourceMappingURL=heic-codec.js.map
