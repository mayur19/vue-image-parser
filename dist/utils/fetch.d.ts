/**
 * Fetch wrapper with abort/timeout support.
 */
export interface FetchOptions {
    signal?: AbortSignal;
    timeout?: number;
    onProgress?: (progress: number) => void;
}
/**
 * Fetch a URL and return the response as an ArrayBuffer.
 * Supports timeout, abort, and progress tracking.
 */
export declare function fetchAsArrayBuffer(url: string, options?: FetchOptions): Promise<ArrayBuffer>;
//# sourceMappingURL=fetch.d.ts.map