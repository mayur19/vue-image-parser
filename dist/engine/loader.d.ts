import { DecodedImage } from '../types/image';
import { LoadOptions } from '../types/options';

/**
 * Load and decode an image from any source.
 *
 * @param source - URL string, File, Blob, or ArrayBuffer
 * @param options - Loading options (abort, timeout, strategy override)
 * @returns Decoded image with normalized RGBA pixel data
 *
 * @throws FormatDetectionError if the format cannot be identified
 * @throws CodecError if decoding fails
 * @throws AbortError if cancelled via AbortSignal
 */
export declare function loadImage(source: string | File | Blob | ArrayBuffer, options?: LoadOptions): Promise<DecodedImage>;
/**
 * Dispose global resources (worker pool, codecs).
 */
export declare function disposeEngine(): void;
//# sourceMappingURL=loader.d.ts.map