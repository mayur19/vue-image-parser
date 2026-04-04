/**
 * vue-image-parser — Public API barrel export.
 *
 * This is the single entry point for all public APIs.
 * Internal modules like workers, codecs, and capability detection
 * are NOT exported directly.
 */

// ─── Core Functions ────────────────────────────────────────────
export { loadImage, disposeEngine } from './engine/loader';
export { renderImage } from './rendering/renderer';
export { detectFormat, detectFormatFromBlob } from './detection/detect';

// ─── Vue Integration ───────────────────────────────────────────
export { useImage } from './vue/useImage';
export type { UseImageReturn } from './vue/useImage';
export { default as UniversalImage } from './vue/UniversalImage.vue';
export { ImageParserPlugin } from './vue/plugin';

// ─── Data URL / Blob URL Utilities ─────────────────────────────
export { toDataURL, toBlobURL, toImageBitmap } from './rendering/bitmap-renderer';

// ─── Public Types ──────────────────────────────────────────────
export { ImageFormat, UNIVERSALLY_SUPPORTED_FORMATS } from './types/image';
export type { DecodedImage, DecodedFrame, ImageMetadata } from './types/image';
export type { LoadOptions, RenderOptions, RenderTarget, ImageEngine } from './types/options';

// ─── Capability Detection (advanced users) ─────────────────────
export { SupportLevel, FormatFeature } from './types/capability';
export type { FormatSupportResult, DecodeProbeResult } from './types/capability';
export { getCapabilityRegistry } from './capability/capability-registry';
export type { CapabilityDetector } from './capability/capability-registry';

// ─── Error Types ───────────────────────────────────────────────
export {
  ImageParserError,
  FormatDetectionError,
  CodecError,
  WorkerError,
  FetchError,
  TimeoutError,
  AbortError,
} from './errors/errors';
export { ErrorCodes } from './errors/codes';
export type { ErrorCode } from './errors/codes';
