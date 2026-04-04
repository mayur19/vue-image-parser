import { ImageFormat } from '../types/image';

/**
 * Parse the ISOBMFF ftyp box to identify HEIC, HEIF, or AVIF format.
 *
 * Returns ImageFormat.Unknown if the buffer does not contain a valid
 * ftyp box or does not match any known image brands.
 *
 * @param buf - First 64+ bytes of the file
 */
export declare function parseFtyp(buf: Uint8Array): ImageFormat;
/**
 * Quick check: does this buffer look like it might contain an ftyp box?
 * This is a fast pre-filter — if false, skip the full parse.
 */
export declare function couldBeFtyp(buf: Uint8Array): boolean;
//# sourceMappingURL=ftyp.d.ts.map