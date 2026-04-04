/**
 * Codec interfaces for the pluggable decoder registry.
 */

import type { ImageFormat, DecodedImage } from './image';
import type { SupportLevel } from './capability';

/**
 * Options passed to a codec's decode method.
 */
export interface DecodeOptions {
  /** Max dimension – downsample during decode if the codec supports it */
  maxDimension?: number;
  /** Whether to parse EXIF and auto-orient (default: true) */
  autoOrient?: boolean;
}

/**
 * A codec is responsible for decoding a specific set of image formats
 * into normalized RGBA pixel data.
 *
 * Codecs MUST be callable from a Web Worker context.
 */
export interface Codec {
  /** Human-readable codec name (e.g., 'native-browser', 'heic-wasm') */
  readonly name: string;
  /** Image formats this codec can decode */
  readonly formats: ReadonlyArray<ImageFormat>;
  /**
   * Decode raw image bytes into RGBA pixel data.
   * Must be safe to call from a Worker thread.
   */
  decode(buffer: ArrayBuffer, options?: DecodeOptions): Promise<DecodedImage>;
  /**
   * Initialize any WASM modules or heavy resources.
   * Called lazily on first use. Must be idempotent.
   */
  init?(): Promise<void>;
  /**
   * Release WASM memory, heap allocations, or other resources.
   */
  dispose?(): void;
}

/**
 * A codec entry in the registry, with metadata about when to use it.
 */
export interface CodecEntry {
  /** The codec implementation */
  codec: Codec;
  /** If true, this codec uses browser-native decoding (createImageBitmap / <img>) */
  isNative: boolean;
  /** Priority (lower = preferred). Native codecs get 0, WASM codecs get 10. */
  priority: number;
  /** Lazy loader — called once to initialize the codec */
  loader?: () => Promise<void>;
  /**
   * Minimum SupportLevel required from capability detection to use this codec.
   * Native codecs require FULL_SUPPORT.
   * WASM codecs accept any level (they're the fallback).
   */
  requiredSupport: SupportLevel;
}

/**
 * Interface for the codec registry that maps formats to decoders.
 */
export interface CodecRegistryInterface {
  /**
   * Register a codec for one or more formats.
   */
  register(entry: CodecEntry): void;

  /**
   * Get the best codec for a format, considering capability detection results.
   * Returns null if no codec is registered for the format.
   */
  resolve(format: ImageFormat, nativeSupport: SupportLevel): CodecEntry | null;

  /**
   * Get all registered codecs for a format, sorted by priority.
   */
  getAll(format: ImageFormat): ReadonlyArray<CodecEntry>;

  /**
   * Dispose all registered codecs.
   */
  disposeAll(): void;
}
