/**
 * SSR (Server-Side Rendering) safety guards.
 * Prevents runtime errors when library code runs in Node.js (Nuxt SSR).
 */

/**
 * Returns true if running in a browser environment with DOM APIs.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Returns true if Web Workers are available.
 */
export function hasWorkerSupport(): boolean {
  return isBrowser() && typeof Worker !== 'undefined';
}

/**
 * Returns true if OffscreenCanvas is available.
 */
export function hasOffscreenCanvas(): boolean {
  return isBrowser() && typeof OffscreenCanvas !== 'undefined';
}

/**
 * Returns true if createImageBitmap is available.
 */
export function hasCreateImageBitmap(): boolean {
  return isBrowser() && typeof createImageBitmap === 'function';
}

/**
 * Returns true if IndexedDB is available (for persistent probe caching).
 */
export function hasIndexedDB(): boolean {
  return isBrowser() && typeof indexedDB !== 'undefined';
}

/**
 * Returns true if the Fetch API is available.
 */
export function hasFetch(): boolean {
  return typeof fetch === 'function';
}

/**
 * Assert that we're in a browser environment.
 * Throws a clear error if called during SSR.
 */
export function assertBrowser(operation: string): void {
  if (!isBrowser()) {
    throw new Error(
      `[vue-image-parser] ${operation} requires a browser environment. ` +
      `This operation is not available during server-side rendering. ` +
      `Use onMounted() or <ClientOnly> to defer this operation.`,
    );
  }
}
