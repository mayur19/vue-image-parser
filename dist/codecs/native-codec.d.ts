import { Codec, DecodeOptions } from '../types/codec';
import { DecodedImage, ImageFormat } from '../types/image';

/**
 * Native browser codec. Decodes images using createImageBitmap().
 * Supports all formats the browser natively supports.
 */
export declare class NativeCodec implements Codec {
    readonly name = "native-browser";
    readonly formats: ReadonlyArray<ImageFormat>;
    /**
     * Failure callback — injected by the engine to report runtime failures
     * back to the CapabilityRegistry.
     */
    onDecodeFailure?: (format: ImageFormat, error: Error) => void;
    decode(buffer: ArrayBuffer, options?: DecodeOptions): Promise<DecodedImage>;
    /**
     * Read RGBA pixel data from an ImageBitmap.
     */
    private readPixels;
}
//# sourceMappingURL=native-codec.d.ts.map