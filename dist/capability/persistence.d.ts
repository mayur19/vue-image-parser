import { DecodeProbeResult } from '../types/capability';

/**
 * Generate a browser fingerprint for cache invalidation.
 * When the fingerprint changes (browser update, hardware change),
 * cached probe results are discarded.
 *
 * NOT used for tracking — purely for cache keying.
 */
export declare function generateBrowserFingerprint(): string;
/**
 * Persist probe results to IndexedDB.
 *
 * @param results - Map of "format:feature" → DecodeProbeResult
 * @param ttlMs - Cache TTL in milliseconds (default: 30 days)
 */
export declare function persistProbeResults(results: Map<string, DecodeProbeResult>, ttlMs?: number): Promise<void>;
/**
 * Restore persisted probe results from IndexedDB.
 *
 * Returns null if:
 * - IndexedDB is not available
 * - No cached data exists
 * - Browser fingerprint has changed (browser update)
 * - Cache has expired (TTL exceeded)
 */
export declare function restoreProbeResults(): Promise<Map<string, DecodeProbeResult> | null>;
/**
 * Clear all persisted probe results.
 */
export declare function clearProbeCache(): Promise<void>;
//# sourceMappingURL=persistence.d.ts.map