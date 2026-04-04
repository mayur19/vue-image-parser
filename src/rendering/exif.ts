/**
 * EXIF orientation parser.
 * Reads EXIF orientation tag from JPEG files for auto-orientation.
 */

/**
 * EXIF orientation values (1-8).
 * 1 = Normal (no rotation needed)
 * 2 = Flipped horizontally
 * 3 = Rotated 180°
 * 4 = Flipped vertically
 * 5 = Rotated 90° CW + flipped horizontally
 * 6 = Rotated 90° CW
 * 7 = Rotated 90° CCW + flipped horizontally
 * 8 = Rotated 90° CCW
 */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Read EXIF orientation from JPEG data.
 * Returns 1 (normal) if EXIF data is not found or not a JPEG.
 *
 * @param buffer - Raw JPEG bytes (at least first 64KB)
 */
export function readExifOrientation(buffer: ArrayBuffer): ExifOrientation {
  const view = new DataView(buffer);
  const length = Math.min(buffer.byteLength, 65536);

  // Must start with JPEG SOI marker (0xFFD8)
  if (length < 2 || view.getUint16(0) !== 0xFFD8) {
    return 1;
  }

  let offset = 2;

  while (offset < length - 4) {
    const marker = view.getUint16(offset);
    offset += 2;

    // APP1 marker (0xFFE1) — contains EXIF
    if (marker === 0xFFE1) {
      const segmentLength = view.getUint16(offset);
      offset += 2;

      // Check for "Exif\0\0" header
      if (
        offset + 6 >= length ||
        view.getUint32(offset) !== 0x45786966 || // "Exif"
        view.getUint16(offset + 4) !== 0x0000
      ) {
        return 1;
      }

      return parseExifOrientation(view, offset + 6, segmentLength - 8);
    }

    // Skip other segments
    if ((marker & 0xFF00) === 0xFF00) {
      const segLen = view.getUint16(offset);
      offset += segLen;
    } else {
      break;
    }
  }

  return 1;
}

/**
 * Parse EXIF IFD to find orientation tag (0x0112).
 */
function parseExifOrientation(view: DataView, tiffStart: number, maxLength: number): ExifOrientation {
  const end = Math.min(tiffStart + maxLength, view.byteLength);

  if (tiffStart + 8 > end) return 1;

  // Determine byte order
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949; // "II" = little-endian

  // Verify TIFF magic number (0x002A)
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002A) {
    return 1;
  }

  // Get IFD0 offset
  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + ifd0Offset;

  if (ifdStart + 2 > end) return 1;

  const entryCount = view.getUint16(ifdStart, littleEndian);

  // Scan IFD entries for orientation tag (0x0112)
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > end) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x0112) {
      const value = view.getUint16(entryOffset + 8, littleEndian);
      if (value >= 1 && value <= 8) {
        return value as ExifOrientation;
      }
    }
  }

  return 1;
}

/**
 * Apply EXIF orientation to RGBA pixel data.
 * Returns new pixel data with corrected orientation and new dimensions.
 */
export function applyOrientation(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  orientation: ExifOrientation,
): { data: Uint8ClampedArray; width: number; height: number } {
  if (orientation === 1) {
    return { data, width, height };
  }

  // For orientations 5-8, width and height are swapped
  const swapDimensions = orientation >= 5;
  const outWidth = swapDimensions ? height : width;
  const outHeight = swapDimensions ? width : height;
  const result = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      let dstX: number, dstY: number;

      switch (orientation) {
        case 2: dstX = width - 1 - x; dstY = y; break;
        case 3: dstX = width - 1 - x; dstY = height - 1 - y; break;
        case 4: dstX = x; dstY = height - 1 - y; break;
        case 5: dstX = y; dstY = x; break;
        case 6: dstX = height - 1 - y; dstY = x; break;
        case 7: dstX = height - 1 - y; dstY = width - 1 - x; break;
        case 8: dstX = y; dstY = width - 1 - x; break;
        default: dstX = x; dstY = y;
      }

      const dstIdx = (dstY * outWidth + dstX) * 4;
      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return { data: result, width: outWidth, height: outHeight };
}
