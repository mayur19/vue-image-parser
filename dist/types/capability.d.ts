import { ImageFormat } from './image';

/**
 * Specific decoding features that may or may not be supported
 * independently by a browser's native decoder.
 */
export declare enum FormatFeature {
    /** Basic still-image decode */
    BASE_DECODE = "base_decode",
    /** Alpha/transparency channel preservation */
    ALPHA = "alpha",
    /** Multi-frame animation playback */
    ANIMATION = "animation",
    /** 10-bit or higher color depth decode */
    HIGH_BIT_DEPTH = "high_bit_depth",
    /** HDR / wide gamut color rendering */
    HDR = "hdr",
    /** Grid/tiled image assembly (HEIC iPhones) */
    GRID_TILING = "grid_tiling"
}
/**
 * Tiered support level determined by pixel-verified decode probing.
 * PARTIAL_SUPPORT and NO_SUPPORT both route to WASM in the pipeline.
 */
export declare enum SupportLevel {
    /** Decode is correct (pixels match expected) and performant */
    FULL_SUPPORT = "full_support",
    /** Decode partially works — wrong pixels, slow, or sub-feature failure */
    PARTIAL_SUPPORT = "partial_support",
    /** Decode fails entirely or produces blank/zero output */
    NO_SUPPORT = "no_support",
    /** Probe has not been run yet; default to conservative WASM path */
    UNKNOWN = "unknown"
}
/**
 * A minimal test image (<500 bytes) with known expected pixel output.
 * Used to verify that the browser's native decoder produces correct results.
 */
export interface ProbeAsset {
    /** Format being tested */
    readonly format: ImageFormat;
    /** Specific feature being tested */
    readonly feature: FormatFeature;
    /** Base64-encoded minimal image bytes */
    readonly base64: string;
    /** MIME type for Blob construction */
    readonly mimeType: string;
    /** Expected image dimensions after decode */
    readonly expectedWidth: number;
    readonly expectedHeight: number;
    /**
     * Expected RGBA pixel values at specific coordinates.
     * For lossy formats, tolerance is applied per channel.
     */
    readonly expectedPixels: ReadonlyArray<ExpectedPixel>;
    /**
     * Per-channel tolerance (0–255).
     * 0 for lossless formats (PNG), 5–15 for lossy (JPEG, AVIF, HEIC).
     */
    readonly tolerance: number;
}
/**
 * Expected pixel value at a specific coordinate in a probe image.
 */
export interface ExpectedPixel {
    readonly x: number;
    readonly y: number;
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}
/**
 * Result of comparing a single pixel against its expected value.
 */
export interface PixelComparisonResult {
    readonly x: number;
    readonly y: number;
    readonly expected: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    readonly actual: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    /** Max absolute delta across all four channels */
    readonly maxDelta: number;
    /** Whether this pixel is within the probe's tolerance */
    readonly passes: boolean;
}
/**
 * Result of a single decode probe execution.
 */
export interface DecodeProbeResult {
    /** Format that was tested */
    readonly format: ImageFormat;
    /** Feature that was tested */
    readonly feature: FormatFeature;
    /** Did createImageBitmap / img.onload succeed at all? */
    readonly loadSucceeded: boolean;
    /** Did decoded dimensions match expected? */
    readonly dimensionsMatch: boolean;
    /** Per-pixel comparison results (empty if load failed) */
    readonly pixelResults: ReadonlyArray<PixelComparisonResult>;
    /** Overall pixel accuracy (0.0–1.0). 0 if load failed. */
    readonly pixelAccuracy: number;
    /** Decode time in milliseconds */
    readonly decodeTimeMs: number;
    /** Computed support level */
    readonly support: SupportLevel;
    /** Human-readable diagnostic string (for logging/telemetry) */
    readonly diagnostic: string;
    /** Timestamp when this probe was executed */
    readonly timestamp: number;
}
/**
 * Aggregated support state for a format across all probed features.
 * This is the primary output consumed by the decode pipeline.
 */
export interface FormatSupportResult {
    /** The format this result describes */
    readonly format: ImageFormat;
    /** Support level per feature */
    readonly features: ReadonlyMap<FormatFeature, SupportLevel>;
    /** Pipeline recommendation for the decode engine */
    readonly recommendation: 'use_native' | 'use_wasm' | 'unknown';
    /**
     * Whether the base decode probe has actually been executed.
     * If false, the recommendation is based on heuristics/defaults.
     */
    readonly verified: boolean;
    /** Timestamp of last probe execution (null if never probed) */
    readonly lastProbeTimestamp: number | null;
    /** Decode time from the base decode probe (null if not probed) */
    readonly decodeTimeMs: number | null;
}
/**
 * Options for running a single decode probe.
 */
export interface ProbeOptions {
    /** Force re-probe even if a cached result exists */
    force?: boolean;
    /** Timeout for the probe in milliseconds (default: 5000) */
    timeout?: number;
    /** Decode time above this threshold → PARTIAL_SUPPORT (default: 100) */
    performanceThresholdMs?: number;
}
/**
 * Options for running all format probes at once.
 */
export interface ProbeAllOptions extends ProbeOptions {
    /** Max concurrent probes (default: 3) */
    concurrency?: number;
    /** Only probe these formats (default: all non-universal) */
    formats?: ImageFormat[];
}
/**
 * Persistent cache entry stored in IndexedDB.
 */
export interface PersistedProbeCache {
    /** Browser fingerprint hash — cache is invalidated when this changes */
    fingerprint: string;
    /** Map of format → DecodeProbeResult for each probed format/feature */
    results: Record<string, DecodeProbeResult>;
    /** Timestamp when this cache was written */
    persistedAt: number;
    /** TTL in milliseconds (default: 30 days) */
    ttlMs: number;
}
//# sourceMappingURL=capability.d.ts.map