/**
 * Worker communication protocol types.
 * Defines the message format between main thread and decode workers.
 * All messages use Transferable objects where possible for zero-copy transfers.
 */

import type { ImageFormat } from './image';
import type { DecodeOptions } from './codec';

// ─── Main Thread → Worker ────────────────────────────────────────

export type WorkerRequest =
  | WorkerDecodeRequest
  | WorkerInitCodecRequest
  | WorkerDisposeRequest;

export interface WorkerDecodeRequest {
  type: 'decode';
  /** Unique request ID for correlating responses */
  id: string;
  /** Raw image bytes (transferred, not copied) */
  buffer: ArrayBuffer;
  /** Pre-detected format (avoids re-detection in worker) */
  format: ImageFormat;
  /** Decode options */
  options?: DecodeOptions;
}

export interface WorkerInitCodecRequest {
  type: 'init-codec';
  /** Unique request ID */
  id: string;
  /** Format whose codec should be initialized */
  format: ImageFormat;
}

export interface WorkerDisposeRequest {
  type: 'dispose';
}

// ─── Worker → Main Thread ────────────────────────────────────────

export type WorkerResponse =
  | WorkerDecodeResult
  | WorkerDecodeError
  | WorkerInitResult
  | WorkerReady;

export interface WorkerDecodeResult {
  type: 'decode-result';
  /** Correlates to the request ID */
  id: string;
  /** Decoded image data in transferable format */
  image: TransferableDecodedImage;
}

export interface WorkerDecodeError {
  type: 'decode-error';
  /** Correlates to the request ID */
  id: string;
  /** Serialized error (Error objects can't be transferred) */
  error: SerializedError;
}

export interface WorkerInitResult {
  type: 'init-result';
  /** Correlates to the request ID */
  id: string;
  /** Whether initialization succeeded */
  success: boolean;
  /** Error details if init failed */
  error?: SerializedError;
}

export interface WorkerReady {
  type: 'ready';
}

// ─── Shared Transfer Types ───────────────────────────────────────

/**
 * Image data in a format suitable for postMessage transfer.
 * The `data` ArrayBuffer is transferred (zero-copy), not cloned.
 */
export interface TransferableDecodedImage {
  /** Raw RGBA pixel data as ArrayBuffer (transferred) */
  data: ArrayBuffer;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Detected format */
  format: ImageFormat;
  /** EXIF orientation (1 = normal, already applied) */
  orientation: number;
  /** Decode path used */
  decodePath: 'native' | 'wasm';
}

/**
 * JSON-serializable error for transfer across worker boundary.
 */
export interface SerializedError {
  /** Error code from errors/codes.ts */
  code: string;
  /** Human-readable message */
  message: string;
  /** Stack trace (development only) */
  stack?: string;
}

// ─── Worker Pool Types ───────────────────────────────────────────

/**
 * State of a single worker in the pool.
 */
export interface PooledWorker {
  /** The Worker instance */
  instance: Worker;
  /** Whether this worker is currently processing a task */
  busy: boolean;
  /** Number of tasks this worker has processed */
  taskCount: number;
  /** Timestamp of last activity */
  lastActivity: number;
}

/**
 * A queued task waiting for a free worker.
 */
export interface QueuedTask {
  /** The request to send when a worker becomes available */
  request: WorkerRequest;
  /** Resolve the caller's promise with the response */
  resolve: (response: WorkerResponse) => void;
  /** Reject the caller's promise on error */
  reject: (error: Error) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Timestamp when the task was enqueued */
  enqueuedAt: number;
}
