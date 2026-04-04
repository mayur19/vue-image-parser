import { Codec, DecodeOptions } from '../../types/codec';
import { DecodedImage, ImageFormat } from '../../types/image';

/**
 * HEIC decoder using libheif-js WASM.
 */
export declare class HeicCodec implements Codec {
    readonly name = "heic-wasm";
    readonly formats: ReadonlyArray<ImageFormat>;
    private heifModule;
    private initialized;
    /**
     * Initialize the libheif WASM module.
     * Must be called before decode(). Idempotent.
     */
    init(): Promise<void>;
    /**
     * Decode a HEIC/HEIF buffer into RGBA pixel data.
     */
    decode(buffer: ArrayBuffer, _options?: DecodeOptions): Promise<DecodedImage>;
    /**
     * Dispose WASM resources.
     */
    dispose(): void;
}
//# sourceMappingURL=heic-codec.d.ts.map