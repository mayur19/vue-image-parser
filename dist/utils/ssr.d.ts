/**
 * SSR (Server-Side Rendering) safety guards.
 * Prevents runtime errors when library code runs in Node.js (Nuxt SSR).
 */
/**
 * Returns true if running in a browser environment with DOM APIs.
 */
export declare function isBrowser(): boolean;
/**
 * Returns true if Web Workers are available.
 */
export declare function hasWorkerSupport(): boolean;
/**
 * Returns true if OffscreenCanvas is available.
 */
export declare function hasOffscreenCanvas(): boolean;
/**
 * Returns true if createImageBitmap is available.
 */
export declare function hasCreateImageBitmap(): boolean;
/**
 * Returns true if IndexedDB is available (for persistent probe caching).
 */
export declare function hasIndexedDB(): boolean;
/**
 * Returns true if the Fetch API is available.
 */
export declare function hasFetch(): boolean;
/**
 * Assert that we're in a browser environment.
 * Throws a clear error if called during SSR.
 */
export declare function assertBrowser(operation: string): void;
//# sourceMappingURL=ssr.d.ts.map