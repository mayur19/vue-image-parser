/**
 * Persistent probe cache using IndexedDB.
 * 
 * Caches decode probe results across page loads to avoid re-probing
 * on every session. Invalidates when the browser version changes
 * (detected via fingerprinting).
 */

import type { DecodeProbeResult, PersistedProbeCache } from '../types/capability';
import { hasIndexedDB } from '../utils/ssr';

const DB_NAME = 'vue-image-parser-capabilities';
const STORE_NAME = 'probe-cache';
const DB_VERSION = 1;

/** Default TTL: 30 days */
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generate a browser fingerprint for cache invalidation.
 * When the fingerprint changes (browser update, hardware change),
 * cached probe results are discarded.
 *
 * NOT used for tracking — purely for cache keying.
 */
export function generateBrowserFingerprint(): string {
  const components: string[] = [];

  if (typeof navigator !== 'undefined') {
    components.push(navigator.userAgent || '');
    components.push(String(navigator.hardwareConcurrency ?? 0));
    components.push(navigator.platform || '');
  }

  if (typeof screen !== 'undefined') {
    components.push(`${screen.width}x${screen.height}`);
    components.push(String(screen.colorDepth ?? 0));
  }

  // Simple hash of the components
  const raw = components.join('|');
  return simpleHash(raw);
}

/**
 * Simple non-cryptographic hash for fingerprint comparison.
 * FNV-1a variant.
 */
function simpleHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, unsigned
  }
  return hash.toString(36);
}

/**
 * Open the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist probe results to IndexedDB.
 *
 * @param results - Map of "format:feature" → DecodeProbeResult
 * @param ttlMs - Cache TTL in milliseconds (default: 30 days)
 */
export async function persistProbeResults(
  results: Map<string, DecodeProbeResult>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  try {
    const db = await openDB();
    const fingerprint = generateBrowserFingerprint();

    const cache: PersistedProbeCache = {
      fingerprint,
      results: Object.fromEntries(results),
      persistedAt: Date.now(),
      ttlMs,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(cache, 'main');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);

      tx.oncomplete = () => db.close();
    });
  } catch {
    // IndexedDB failures are non-fatal — just log
    if (typeof console !== 'undefined') {
      console.debug('[vue-image-parser] Failed to persist probe cache');
    }
  }
}

/**
 * Restore persisted probe results from IndexedDB.
 *
 * Returns null if:
 * - IndexedDB is not available
 * - No cached data exists
 * - Browser fingerprint has changed (browser update)
 * - Cache has expired (TTL exceeded)
 */
export async function restoreProbeResults(): Promise<Map<string, DecodeProbeResult> | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('main');

      request.onsuccess = () => {
        const cache = request.result as PersistedProbeCache | undefined;

        if (!cache) {
          resolve(null);
          return;
        }

        // Check fingerprint — invalidate on browser change
        const currentFingerprint = generateBrowserFingerprint();
        if (cache.fingerprint !== currentFingerprint) {
          if (typeof console !== 'undefined') {
            console.debug('[vue-image-parser] Probe cache invalidated: browser fingerprint changed');
          }
          resolve(null);
          return;
        }

        // Check TTL
        const age = Date.now() - cache.persistedAt;
        if (age > cache.ttlMs) {
          if (typeof console !== 'undefined') {
            console.debug(`[vue-image-parser] Probe cache expired (age: ${Math.round(age / 86400000)}d)`);
          }
          resolve(null);
          return;
        }

        // Valid cache — reconstruct Map
        resolve(new Map(Object.entries(cache.results)));
      };

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Clear all persisted probe results.
 */
export async function clearProbeCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Non-fatal
  }
}
