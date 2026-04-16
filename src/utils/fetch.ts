/**
 * Fetch wrapper with abort/timeout support.
 */

import { FetchError, TimeoutError, AbortError } from '../errors/errors';
import { ErrorCodes } from '../errors/codes';

export interface FetchOptions {
  signal?: AbortSignal;
  timeout?: number;
  onProgress?: (progress: number) => void;
  /** Maximum allowed file size in bytes (default: 100 MB) */
  maxFileSize?: number;
}

/** Maximum file size in bytes (default 100 MB) */
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Protocols allowed for fetch. blob: URLs are same-origin object URLs created by URL.createObjectURL. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:']);

/**
 * Validate that a URL uses a safe protocol.
 * Rejects javascript:, file:, and other non-HTTP(S) protocols.
 */
function validateUrl(url: string): void {
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new FetchError(
        ErrorCodes.INVALID_INPUT,
        `Unsafe URL protocol: ${parsed.protocol} — only http:, https:, data:, and blob: are allowed`,
      );
    }
  } catch (error) {
    if (error instanceof FetchError) throw error;
    // Relative URLs are OK — they resolve against the page origin
  }
}

/**
 * Fetch a URL and return the response as an ArrayBuffer.
 * Supports timeout, abort, progress tracking, and file size limits.
 */
export async function fetchAsArrayBuffer(
  url: string,
  options: FetchOptions = {},
): Promise<ArrayBuffer> {
  const { timeout = 30000, signal, onProgress, maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;

  validateUrl(url);

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

    // Check Content-Length against max file size
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (maxFileSize > 0 && contentLength > maxFileSize) {
      throw new FetchError(
        ErrorCodes.FILE_TOO_LARGE,
        `File size ${contentLength} bytes exceeds maximum allowed ${maxFileSize} bytes`,
      );
    }

    // If progress tracking requested and content-length available
    if (onProgress && response.body && contentLength > 0) {
      return readStreamWithProgress(response.body, contentLength, onProgress, maxFileSize);
    }

    const buffer = await response.arrayBuffer();

    // Validate actual size (Content-Length may be missing)
    if (maxFileSize > 0 && buffer.byteLength > maxFileSize) {
      throw new FetchError(
        ErrorCodes.FILE_TOO_LARGE,
        `File size ${buffer.byteLength} bytes exceeds maximum allowed ${maxFileSize} bytes`,
      );
    }

    return buffer;
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
 * Enforces maxFileSize on the actual accumulated bytes (not just Content-Length header).
 */
async function readStreamWithProgress(
  body: ReadableStream<Uint8Array>,
  totalBytes: number,
  onProgress: (progress: number) => void,
  maxFileSize: number,
): Promise<ArrayBuffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.byteLength;

    if (maxFileSize > 0 && receivedBytes > maxFileSize) {
      reader.cancel();
      throw new FetchError(
        ErrorCodes.FILE_TOO_LARGE,
        `Streaming body size ${receivedBytes} bytes exceeds maximum allowed ${maxFileSize} bytes`,
      );
    }

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
