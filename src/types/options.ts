/**
 * Public API options for loadImage() and renderImage().
 */

import type { DecodedImage } from './image';

/**
 * Options for the loadImage() function.
 */
export interface LoadOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /**
   * Force a specific decoding strategy:
   * - 'native': Always use browser-native decoding (createImageBitmap)
   * - 'wasm': Always use WASM decoder (bypass native even if supported)
   * - 'auto': Let capability detection decide (default)
   */
  strategy?: 'native' | 'wasm' | 'auto';
  /** Max dimension — downsample if codec supports it */
  maxDimension?: number;
  /** Maximum file size in bytes (default: 100 MB). Set to 0 to disable. */
  maxFileSize?: number;
  /** Auto-orient based on EXIF data (default: true) */
  autoOrient?: boolean;
  /** Callback for progress tracking (0.0–1.0) */
  onProgress?: (progress: number) => void;
}

/**
 * Options for renderImage() — controls how the decoded image
 * is drawn onto a target element (canvas or container).
 */
export interface RenderOptions {
  /** Object-fit behavior, mirrors CSS object-fit */
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** Target render width in CSS pixels */
  width?: number;
  /** Target render height in CSS pixels */
  height?: number;
  /** Background color for letterboxing (CSS color value) */
  background?: string;
  /** Device pixel ratio for HiDPI rendering (default: window.devicePixelRatio) */
  dpr?: number;
}

/**
 * Render target — the element to render a decoded image into.
 */
export type RenderTarget = HTMLCanvasElement | HTMLElement;

/**
 * The public API surface of the image engine.
 */
export interface ImageEngine {
  /**
   * Load and decode an image from any source.
   * Returns a normalized DecodedImage with RGBA pixel data.
   */
  loadImage(source: string | File | Blob | ArrayBuffer, options?: LoadOptions): Promise<DecodedImage>;

  /**
   * Render a decoded image onto a target element.
   * For canvas targets, draws directly. For other elements, creates an internal canvas.
   */
  renderImage(target: RenderTarget, image: DecodedImage, options?: RenderOptions): void;

  /**
   * Dispose all resources (worker pool, codec instances, caches).
   * Call when the engine is no longer needed.
   */
  dispose(): void;
}
