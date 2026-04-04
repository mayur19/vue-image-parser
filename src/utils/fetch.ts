/**
 * Fetch wrapper with abort/timeout support.
 */

import { FetchError, TimeoutError, AbortError } from '../errors/errors';
import { ErrorCodes } from '../errors/codes';

export interface FetchOptions {
  signal?: AbortSignal;
  timeout?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Fetch a URL and return the response as an ArrayBuffer.
 * Supports timeout, abort, and progress tracking.
 */
export async function fetchAsArrayBuffer(
  url: string,
  options: FetchOptions = {},
): Promise<ArrayBuffer> {
  const { timeout = 30000, signal, onProgress } = options;

  // Create timeout abort if needed
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  // Combine user signal with timeout signal
  const combinedSignal = signal
    ? combineAbortSignals(signal, controller.signal)
    : controller.signal;

  try {
    const response = await fetch(url, { signal: combinedSignal });

    if (!response.ok) {
      throw new FetchError(
        ErrorCodes.FETCH_FAILED,
        `HTTP ${response.status}: ${response.statusText} for ${url}`,
      );
    }

    // If progress tracking requested and content-length available
    if (onProgress && response.body) {
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > 0) {
        return readStreamWithProgress(response.body, contentLength, onProgress);
      }
    }

    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof ImageParserError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal?.aborted) {
        throw new AbortError();
      }
      throw new TimeoutError(ErrorCodes.FETCH_TIMEOUT, `Fetch timed out after ${timeout}ms`);
    }

    throw new FetchError(
      ErrorCodes.FETCH_FAILED,
      `Failed to fetch ${url}: ${(error as Error).message}`,
      error,
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// We need this import for the catch block
import { ImageParserError } from '../errors/errors';

/**
 * Read a ReadableStream with progress tracking.
 */
async function readStreamWithProgress(
  body: ReadableStream<Uint8Array>,
  totalBytes: number,
  onProgress: (progress: number) => void,
): Promise<ArrayBuffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.byteLength;
    onProgress(Math.min(receivedBytes / totalBytes, 1.0));
  }

  // Concatenate chunks
  const result = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result.buffer;
}

/**
 * Combine two AbortSignals — aborts when either fires.
 */
function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if ('any' in AbortSignal) {
    // Modern browsers support AbortSignal.any()
    return (AbortSignal as any).any([a, b]);
  }

  // Fallback: create a new controller that aborts when either signal fires
  const controller = new AbortController();

  const onAbort = () => controller.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);

  if (a.aborted || b.aborted) {
    controller.abort();
  }

  return controller.signal;
}
