/**
 * ISOBMFF (ISO Base Media File Format) ftyp box parser.
 * Used to distinguish HEIC, HEIF, and AVIF images — all of which
 * share the same container format and cannot be identified by
 * simple magic bytes alone.
 *
 * Structure:
 *   Bytes 0-3:  Box size (big-endian uint32)
 *   Bytes 4-7:  Box type ("ftyp" = 0x66747970)
 *   Bytes 8-11: Major brand (4 ASCII chars)
 *   Bytes 12-15: Minor version
 *   Bytes 16+:  Compatible brands (4 bytes each)
 */

import { ImageFormat } from '../types/image';

/** AVIF brands */
const AVIF_BRANDS = new Set(['avif', 'avis']);

/** HEIC brands */
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis']);

/** HEIF brands (generic HEIF without HEVC encoding) */
const HEIF_BRANDS = new Set(['mif1', 'msf1']);

/**
 * Check if bytes 4-7 are "ftyp" (0x66 0x74 0x79 0x70).
 */
function hasFtypBox(buf: Uint8Array): boolean {
  return (
    buf.length >= 12 &&
    buf[4] === 0x66 && // f
    buf[5] === 0x74 && // t
    buf[6] === 0x79 && // y
    buf[7] === 0x70    // p
  );
}

/**
 * Read a 4-byte ASCII brand string from the buffer at the given offset.
 */
function readBrand(buf: Uint8Array, offset: number): string {
  if (offset + 4 > buf.length) return '';
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}

/**
 * Parse the ISOBMFF ftyp box to identify HEIC, HEIF, or AVIF format.
 *
 * Returns ImageFormat.Unknown if the buffer does not contain a valid
 * ftyp box or does not match any known image brands.
 *
 * @param buf - First 64+ bytes of the file
 */
export function parseFtyp(buf: Uint8Array): ImageFormat {
  if (!hasFtypBox(buf)) {
    return ImageFormat.Unknown;
  }

  // Read box size from bytes 0-3 (big-endian uint32)
  const boxSize = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];

  // Sanity check — ftyp box should be small (typically 20-40 bytes)
  // but we cap at what we can read from the buffer
  const readableSize = Math.min(boxSize, buf.length);

  if (readableSize < 12) {
    return ImageFormat.Unknown;
  }

  // Collect all brands: major brand + compatible brands
  const brands = new Set<string>();

  // Major brand at bytes 8-11
  brands.add(readBrand(buf, 8));

  // Compatible brands start at byte 16, each 4 bytes
  // (bytes 12-15 are minor version, skipped)
  for (let offset = 16; offset + 4 <= readableSize; offset += 4) {
    const brand = readBrand(buf, offset);
    if (brand.length === 4) {
      brands.add(brand);
    }
  }

  // Check brands in priority order:
  // AVIF first (AVIF files may also have 'mif1' as compatible brand)
  for (const brand of brands) {
    if (AVIF_BRANDS.has(brand)) return ImageFormat.AVIF;
  }

  // HEIC next (specific HEVC-based HEIF)
  for (const brand of brands) {
    if (HEIC_BRANDS.has(brand)) return ImageFormat.HEIC;
  }

  // Generic HEIF last
  for (const brand of brands) {
    if (HEIF_BRANDS.has(brand)) return ImageFormat.HEIF;
  }

  return ImageFormat.Unknown;
}

/**
 * Quick check: does this buffer look like it might contain an ftyp box?
 * This is a fast pre-filter — if false, skip the full parse.
 */
export function couldBeFtyp(buf: Uint8Array): boolean {
  return hasFtypBox(buf);
}
