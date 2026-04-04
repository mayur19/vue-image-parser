/**
 * Format detection orchestrator.
 * Identifies the image format from raw bytes using binary signature
 * analysis — never file extensions.
 */

import { ImageFormat } from '../types/image';
import { SIGNATURES, MIN_DETECTION_BYTES } from './signatures';
import { parseFtyp, couldBeFtyp } from './ftyp';

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
export function detectFormat(buffer: ArrayBuffer): ImageFormat {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, MIN_DETECTION_BYTES));

  if (bytes.length < 4) {
    return ImageFormat.Unknown;
  }

  // 1. Try simple magic byte signatures
  for (const sig of SIGNATURES) {
    if (sig.match(bytes)) {
      return sig.format;
    }
  }

  // 2. Try ISOBMFF ftyp box (HEIC/HEIF/AVIF)
  if (couldBeFtyp(bytes)) {
    const ftypResult = parseFtyp(bytes);
    if (ftypResult !== ImageFormat.Unknown) {
      return ftypResult;
    }
  }

  return ImageFormat.Unknown;
}

/**
 * Detect format from a Blob or File without reading the entire file.
 * Only reads the first MIN_DETECTION_BYTES bytes.
 */
export async function detectFormatFromBlob(blob: Blob): Promise<ImageFormat> {
  const slice = blob.slice(0, MIN_DETECTION_BYTES);
  const buffer = await slice.arrayBuffer();
  return detectFormat(buffer);
}
