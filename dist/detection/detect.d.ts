import { ImageFormat } from '../types/image';

/**
 * Detect the image format from the first bytes of a file.
 *
 * Detection strategy:
 * 1. Try simple magic byte signatures (JPEG, PNG, GIF, WebP)
 * 2. Try ISOBMFF ftyp box parsing (HEIC, HEIF, AVIF)
 * 3. Return Unknown if no match
 *
 * @param buffer - The full ArrayBuffer or at least the first 64 bytes
 * @returns Detected ImageFormat
 */
export declare function detectFormat(buffer: ArrayBuffer): ImageFormat;
/**
 * Detect format from a Blob or File without reading the entire file.
 * Only reads the first MIN_DETECTION_BYTES bytes.
 */
export declare function detectFormatFromBlob(blob: Blob): Promise<ImageFormat>;
//# sourceMappingURL=detect.d.ts.map