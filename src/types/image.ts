/**
 * Core image types for the vue-image-parser library.
 * These types represent decoded image data flowing through the pipeline.
 */

/**
 * Supported image formats, identified via binary signature detection.
 * Never determined by file extension.
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WebP = 'webp',
  GIF = 'gif',
  HEIC = 'heic',
  HEIF = 'heif',
  AVIF = 'avif',
  Unknown = 'unknown',
}

/**
 * Formats that are universally supported in all modern browsers.
 * These never require probing — hardcoded as FULL_SUPPORT.
 */
export const UNIVERSALLY_SUPPORTED_FORMATS: ReadonlySet<ImageFormat> = new Set([
  ImageFormat.JPEG,
  ImageFormat.PNG,
  ImageFormat.GIF,
]);

/**
 * Decoded image in normalized RGBA format.
 * This is the primary output of the decode pipeline.
 */
export interface DecodedImage {
  /** Raw RGBA pixel data (4 bytes per pixel) */
  readonly data: Uint8ClampedArray;
  /** Image width in pixels */
  readonly width: number;
  /** Image height in pixels */
  readonly height: number;
  /** Detected source format */
  readonly format: ImageFormat;
  /** EXIF orientation (1-8), normalized to 1 after auto-orient */
  readonly orientation: number;
  /** For animated images: array of frames (first frame is also in `data`) */
  readonly frames?: DecodedFrame[];
  /** Whether this image was decoded natively or via WASM */
  readonly decodePath: 'native' | 'wasm';
  /**
   * Release internal pixel buffers and associated resources.
   * Must be called when the image is no longer needed.
   */
  dispose(): void;
}

/**
 * A single frame in an animated image (GIF, animated WebP, animated AVIF).
 */
export interface DecodedFrame {
  /** Raw RGBA pixel data for this frame */
  readonly data: Uint8ClampedArray;
  /** Frame width in pixels */
  readonly width: number;
  /** Frame height in pixels */
  readonly height: number;
  /** Frame delay in milliseconds */
  readonly delay: number;
  /** Frame disposal method */
  readonly disposal: 'none' | 'background' | 'previous';
}

/**
 * Lightweight image metadata extracted from headers without full decode.
 * Used by the capability system to determine which features to probe.
 */
export interface ImageMetadata {
  readonly format: ImageFormat;
  readonly width?: number;
  readonly height?: number;
  readonly hasAlpha?: boolean;
  readonly isAnimated?: boolean;
  readonly bitDepth?: number;
  readonly isGridTiled?: boolean;
}
