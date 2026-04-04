/**
 * CapabilityRegistry — The central capability detection singleton.
 *
 * This is the primary entry point for the decode pipeline to determine
 * whether to use native or WASM decoding for a given format.
 *
 * Design principles:
 * - Conservative default: UNKNOWN → use WASM (never route to untested native)
 * - Lazy probing: no probes at startup; first probe runs on first format encounter
 * - Persistent caching: IndexedDB with browser fingerprint invalidation
 * - Runtime feedback: onNativeDecodeFailure() downgrades and triggers re-probe
 *
 * @see capability_detection_analysis.md for the full rationale
 */

import type {
  DecodeProbeResult,
  FormatSupportResult,
  ProbeOptions,
  ProbeAllOptions,
} from '../types/capability';
import { ImageFormat, UNIVERSALLY_SUPPORTED_FORMATS } from '../types/image';
import { FormatFeature, SupportLevel } from '../types/capability';
import { getProbeAsset, getProbableFormats, getFormatProbes } from './format-probe';
import { runDecodeTest } from './decode-test';
import { persistProbeResults, restoreProbeResults } from './persistence';
import { isBrowser } from '../utils/ssr';

/**
 * CapabilityDetector interface — implemented by CapabilityRegistry.
 */
export interface CapabilityDetector {
  query(format: ImageFormat, feature?: FormatFeature): FormatSupportResult;
  probe(format: ImageFormat, feature?: FormatFeature, options?: ProbeOptions): Promise<DecodeProbeResult>;
  probeAll(options?: ProbeAllOptions): Promise<ReadonlyMap<ImageFormat, FormatSupportResult>>;
  resolve(format: ImageFormat): Promise<'use_native' | 'use_wasm'>;
  invalidate(format: ImageFormat): void;
  onNativeDecodeFailure(format: ImageFormat, error: Error): void;
  persist(): Promise<void>;
  restore(): Promise<boolean>;
}

/**
 * Cache key for in-memory probe results.
 */
function cacheKey(format: ImageFormat, feature: FormatFeature): string {
  return `${format}:${feature}`;
}

/**
 * CapabilityRegistry singleton implementation.
 */
class CapabilityRegistryImpl implements CapabilityDetector {
  /** L1 in-memory cache: cacheKey → DecodeProbeResult */
  private readonly cache = new Map<string, DecodeProbeResult>();

  /** In-flight probes to avoid duplicate concurrent probes for the same format */
  private readonly inFlight = new Map<string, Promise<DecodeProbeResult>>();

  /** Formats that have been downgraded at runtime via onNativeDecodeFailure */
  private readonly downgradedFormats = new Set<ImageFormat>();

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Query cached support level for a format. Does NOT trigger a probe.
   * Returns UNKNOWN recommendation if the format has never been probed.
   */
  query(format: ImageFormat, feature: FormatFeature = FormatFeature.BASE_DECODE): FormatSupportResult {
    // Universal formats are always FULL_SUPPORT
    if (UNIVERSALLY_SUPPORTED_FORMATS.has(format)) {
      return this.createUniversalResult(format);
    }

    return this.buildFormatResult(format);
  }

  /**
   * Run a pixel-verified decode probe for a format/feature.
   * Returns cached result unless force=true.
   */
  async probe(
    format: ImageFormat,
    feature: FormatFeature = FormatFeature.BASE_DECODE,
    options: ProbeOptions = {},
  ): Promise<DecodeProbeResult> {
    // Universal formats don't need probing
    if (UNIVERSALLY_SUPPORTED_FORMATS.has(format)) {
      return this.createSyntheticProbeResult(format, feature, SupportLevel.FULL_SUPPORT);
    }

    const key = cacheKey(format, feature);

    // Return cached unless force
    if (!options.force && this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Deduplicate in-flight probes
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    const probePromise = this.executeProbe(format, feature, options);
    this.inFlight.set(key, probePromise);

    try {
      const result = await probePromise;
      this.cache.set(key, result);
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /**
   * Run base-decode probes for all registered formats concurrently.
   */
  async probeAll(options: ProbeAllOptions = {}): Promise<ReadonlyMap<ImageFormat, FormatSupportResult>> {
    const formats = options.formats ?? getProbableFormats();
    const concurrency = options.concurrency ?? 3;

    // Probe in batches
    const batches: ImageFormat[][] = [];
    for (let i = 0; i < formats.length; i += concurrency) {
      batches.push(formats.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(format => this.probe(format, FormatFeature.BASE_DECODE, options)),
      );
    }

    // Build results map
    const results = new Map<ImageFormat, FormatSupportResult>();
    for (const format of formats) {
      results.set(format, this.buildFormatResult(format));
    }

    return results;
  }

  /**
   * Get pipeline recommendation for a format.
   * 
   * This is the primary entry point used by engine/loader.ts.
   *
   * - If probed with FULL_SUPPORT → 'use_native'
   * - If unprobed → 'use_wasm' (conservative), starts background probe
   * - If probed with anything else → 'use_wasm'
   * - If downgraded via onNativeDecodeFailure → 'use_wasm'
   */
  async resolve(format: ImageFormat): Promise<'use_native' | 'use_wasm'> {
    // Universal formats always use native
    if (UNIVERSALLY_SUPPORTED_FORMATS.has(format)) {
      return 'use_native';
    }

    // If format was downgraded at runtime, always WASM
    if (this.downgradedFormats.has(format)) {
      return 'use_wasm';
    }

    // Not in browser → always WASM (SSR safety)
    if (!isBrowser()) {
      return 'use_wasm';
    }

    // Check cache for base decode
    const key = cacheKey(format, FormatFeature.BASE_DECODE);
    const cached = this.cache.get(key);

    if (cached) {
      return cached.support === SupportLevel.FULL_SUPPORT ? 'use_native' : 'use_wasm';
    }

    // No cached probe — conservative default: use WASM for this image.
    // Start an async background probe so future images benefit.
    this.probe(format, FormatFeature.BASE_DECODE).catch(() => {
      // Non-fatal — background probe failures are silent
    });

    return 'use_wasm';
  }

  /**
   * Invalidate cached probe results for a format.
   * Next resolve() call will re-probe.
   */
  invalidate(format: ImageFormat): void {
    for (const [key] of this.cache) {
      if (key.startsWith(`${format}:`)) {
        this.cache.delete(key);
      }
    }
    this.downgradedFormats.delete(format);
  }

  /**
   * Runtime failure feedback.
   *
   * Called by native-codec.ts when createImageBitmap fails for an image
   * that the probe said should be FULL_SUPPORT.
   *
   * This immediately downgrades the format and triggers a re-probe.
   */
  onNativeDecodeFailure(format: ImageFormat, error: Error): void {
    if (typeof console !== 'undefined') {
      console.warn(
        `[vue-image-parser] Native decode failed for ${format} after probe indicated support. ` +
        `Downgrading to WASM.`,
        error.message,
      );
    }

    this.downgradedFormats.add(format);

    // Invalidate and re-probe in background
    this.invalidate(format);
    this.downgradedFormats.add(format); // Re-add after invalidate cleared it

    // Background re-probe (will update cache but format stays downgraded
    // until manually invalidated or page reload)
    this.probe(format, FormatFeature.BASE_DECODE, { force: true }).catch(() => {});
  }

  /**
   * Persist all cached probe results to IndexedDB.
   */
  async persist(): Promise<void> {
    await persistProbeResults(this.cache);
  }

  /**
   * Restore probe results from IndexedDB.
   * Returns true if valid cache was found and loaded.
   */
  async restore(): Promise<boolean> {
    const cached = await restoreProbeResults();
    if (!cached) return false;

    for (const [key, result] of cached) {
      this.cache.set(key, result);
    }

    return true;
  }

  // ─── Private ─────────────────────────────────────────────────

  /**
   * Execute a single probe (no caching, no deduplication).
   */
  private async executeProbe(
    format: ImageFormat,
    feature: FormatFeature,
    options: ProbeOptions,
  ): Promise<DecodeProbeResult> {
    const asset = getProbeAsset(format, feature);

    if (!asset) {
      // No probe registered for this format/feature
      return this.createSyntheticProbeResult(format, feature, SupportLevel.UNKNOWN);
    }

    return runDecodeTest(asset, {
      timeout: options.timeout,
      performanceThresholdMs: options.performanceThresholdMs,
    });
  }

  /**
   * Build a FormatSupportResult from all cached probes for a format.
   */
  private buildFormatResult(format: ImageFormat): FormatSupportResult {
    const features = new Map<FormatFeature, SupportLevel>();
    let baseProbe: DecodeProbeResult | undefined;

    // Gather all cached probe results for this format
    for (const [key, result] of this.cache) {
      if (key.startsWith(`${format}:`)) {
        const feature = key.split(':')[1] as FormatFeature;
        features.set(feature, result.support);

        if (feature === FormatFeature.BASE_DECODE) {
          baseProbe = result;
        }
      }
    }

    // Determine recommendation
    let recommendation: 'use_native' | 'use_wasm' | 'unknown';

    if (this.downgradedFormats.has(format)) {
      recommendation = 'use_wasm';
    } else if (baseProbe) {
      recommendation = baseProbe.support === SupportLevel.FULL_SUPPORT ? 'use_native' : 'use_wasm';
    } else {
      recommendation = 'unknown';
    }

    return {
      format,
      features,
      recommendation,
      verified: baseProbe !== undefined,
      lastProbeTimestamp: baseProbe?.timestamp ?? null,
      decodeTimeMs: baseProbe?.decodeTimeMs ?? null,
    };
  }

  /**
   * Create a result for universally supported formats (JPEG, PNG, GIF).
   */
  private createUniversalResult(format: ImageFormat): FormatSupportResult {
    return {
      format,
      features: new Map([[FormatFeature.BASE_DECODE, SupportLevel.FULL_SUPPORT]]),
      recommendation: 'use_native',
      verified: true,
      lastProbeTimestamp: null,
      decodeTimeMs: null,
    };
  }

  /**
   * Create a synthetic probe result for formats without a registered probe.
   */
  private createSyntheticProbeResult(
    format: ImageFormat,
    feature: FormatFeature,
    support: SupportLevel,
  ): DecodeProbeResult {
    return {
      format,
      feature,
      loadSucceeded: support === SupportLevel.FULL_SUPPORT,
      dimensionsMatch: support === SupportLevel.FULL_SUPPORT,
      pixelResults: [],
      pixelAccuracy: support === SupportLevel.FULL_SUPPORT ? 1.0 : 0,
      decodeTimeMs: 0,
      support,
      diagnostic: support === SupportLevel.FULL_SUPPORT
        ? 'Universally supported format'
        : 'No probe asset registered',
      timestamp: Date.now(),
    };
  }
}

// ─── Singleton ─────────────────────────────────────────────────

let instance: CapabilityRegistryImpl | null = null;

/**
 * Get the global CapabilityRegistry singleton.
 */
export function getCapabilityRegistry(): CapabilityDetector {
  if (!instance) {
    instance = new CapabilityRegistryImpl();
  }
  return instance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetCapabilityRegistry(): void {
  instance = null;
}
