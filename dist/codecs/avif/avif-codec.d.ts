import { Codec, DecodeOptions } from '../../types/codec';
import { DecodedImage, ImageFormat } from '../../types/image';

/**
 * AVIF decoder using @jsquash/avif WASM.
 */
export declare class AvifCodec implements Codec {
    readonly name = "avif-wasm";
    readonly formats: ReadonlyArray<ImageFormat>;
    private decodeFn;
    private initialized;
    /**
     * Initialize the @jsquash/avif WASM module.
     * Must be called before decode(). Idempotent.
     */
    init(): Promise<void>;
    /**
     * Decode an AVIF buffer into RGBA pixel data.
     */
    decode(buffer: ArrayBuffer, _options?: DecodeOptions): Promise<DecodedImage>;
    /**
     * Dispose WASM resources.
     */
    dispose(): void;
}
//# sourceMappingURL=avif-codec.d.ts.map