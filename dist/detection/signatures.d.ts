import { ImageFormat } from '../types/image';

/**
 * Signature checker function type.
 * Takes a Uint8Array view of the first bytes and returns true if matched.
 */
type SignatureMatcher = (buf: Uint8Array) => boolean;
/**
 * Ordered list of signature matchers — checked sequentially.
 * Order matters: more specific signatures are checked before generic ones.
 */
export declare const SIGNATURES: ReadonlyArray<{
    format: ImageFormat;
    match: SignatureMatcher;
}>;
/**
 * Minimum number of bytes needed for signature detection.
 * 64 bytes is sufficient for all magic numbers + ftyp box parsing.
 */
export declare const MIN_DETECTION_BYTES = 64;
export {};
//# sourceMappingURL=signatures.d.ts.map