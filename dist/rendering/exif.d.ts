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
export declare function readExifOrientation(buffer: ArrayBuffer): ExifOrientation;
/**
 * Apply EXIF orientation to RGBA pixel data.
 * Returns new pixel data with corrected orientation and new dimensions.
 */
export declare function applyOrientation(data: Uint8ClampedArray, width: number, height: number, orientation: ExifOrientation): {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};
//# sourceMappingURL=exif.d.ts.map