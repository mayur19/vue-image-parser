/**
 * Magic byte signature matchers for image format detection.
 * Each matcher operates on the first N bytes of a file.
 */

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
export const SIGNATURES: ReadonlyArray<{ format: ImageFormat; match: SignatureMatcher }> = [
  {
    // JPEG: starts with FF D8 FF
    format: ImageFormat.JPEG,
    match: (buf) => buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
  },
  {
    // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    format: ImageFormat.PNG,
    match: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A,
  },
  {
    // GIF: starts with "GIF87a" or "GIF89a"
    format: ImageFormat.GIF,
    match: (buf) =>
      buf.length >= 6 &&
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61,
  },
  {
    // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
    format: ImageFormat.WebP,
    match: (buf) =>
      buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50,
  },
  // HEIC/HEIF/AVIF are handled by ftyp parser — not matched here.
  // They share the ISOBMFF container and need brand-level parsing.
];

/**
 * Minimum number of bytes needed for signature detection.
 * 64 bytes is sufficient for all magic numbers + ftyp box parsing.
 */
export const MIN_DETECTION_BYTES = 64;
